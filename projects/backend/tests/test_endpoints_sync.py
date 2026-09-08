"""Convergence and cross-tenant tests for the offline sync endpoints
(BACKEND_PLAN.md §8, §14's airplane-mode gate: create/edit/delete offline,
reconnect, confirm convergence; a replayed batch changes nothing)."""

from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient


def _auth(uid: str) -> Any:
    return patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    )


@pytest.mark.asyncio
async def test_push_create_update_delete_converges(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """A full offline session — create, edit, delete — replayed twice
    converges to the same state; the replay changes nothing."""
    uid = f"farmer_{uuid4()}"
    farm_id = str(uuid4())
    land_id = str(uuid4())
    crop_id = str(uuid4())

    batch = {
        "operations": [
            {
                "entity_type": "farms",
                "id": farm_id,
                "operation": "create",
                "payload": {"name": "Offline Farm", "state": "Punjab"},
            },
            {
                "entity_type": "lands",
                "id": land_id,
                "operation": "create",
                "payload": {"name": "Offline Land", "farm_id": farm_id},
            },
            {
                "entity_type": "crops",
                "id": crop_id,
                "operation": "create",
                "payload": {
                    "land_id": land_id,
                    "crop_catalog_id": reference_ids["crop_catalog_id"],
                    "season": "Rabi",
                },
            },
            {
                "entity_type": "crops",
                "id": crop_id,
                "operation": "update",
                "payload": {"current_stage": "flowering"},
            },
            {
                "entity_type": "lands",
                "id": land_id,
                "operation": "delete",
                "payload": {},
            },
        ]
    }

    with _auth(uid):
        resp1 = await client.post(
            "/api/v1/sync/push", headers={"Authorization": "Bearer t"}, json=batch
        )
        assert resp1.status_code == 200
        assert all(r["status"] == "ok" for r in resp1.json()["results"])

        # Replay the exact same batch (simulates a retried push after a
        # dropped connection) — must be a no-op.
        resp2 = await client.post(
            "/api/v1/sync/push", headers={"Authorization": "Bearer t"}, json=batch
        )
        assert resp2.status_code == 200
        assert all(r["status"] == "ok" for r in resp2.json()["results"])

        farm_resp = await client.get(
            f"/api/v1/farms/{farm_id}", headers={"Authorization": "Bearer t"}
        )
        assert farm_resp.status_code == 200
        assert farm_resp.json()["name"] == "Offline Farm"

        land_resp = await client.get(
            f"/api/v1/lands/{land_id}", headers={"Authorization": "Bearer t"}
        )
        assert land_resp.status_code == 404  # soft-deleted, both times

        crop_resp = await client.get(
            f"/api/v1/crops/{crop_id}", headers={"Authorization": "Bearer t"}
        )
        assert crop_resp.status_code == 200
        assert crop_resp.json()["current_stage"] == "flowering"
        assert crop_resp.json()["season"] == "Rabi"

        # Exactly one farm and one crop — the replay didn't duplicate rows.
        farms_list = await client.get(
            "/api/v1/farms", headers={"Authorization": "Bearer t"}
        )
        assert len(farms_list.json()["items"]) == 1
        crops_list = await client.get(
            "/api/v1/crops", headers={"Authorization": "Bearer t"}
        )
        assert len(crops_list.json()["items"]) == 1


@pytest.mark.asyncio
async def test_push_cross_tenant_id_conflict(client: AsyncClient) -> None:
    """A push with an id already owned by a different farmer errors
    per-item instead of silently overwriting it or 500ing."""
    uid_a = f"farmer_a_{uuid4()}"
    uid_b = f"farmer_b_{uuid4()}"
    farm_id = str(uuid4())

    with _auth(uid_a):
        resp = await client.post(
            "/api/v1/sync/push",
            headers={"Authorization": "Bearer a"},
            json={
                "operations": [
                    {
                        "entity_type": "farms",
                        "id": farm_id,
                        "operation": "create",
                        "payload": {"name": "Farm A"},
                    }
                ]
            },
        )
        assert resp.json()["results"][0]["status"] == "ok"

    with _auth(uid_b):
        resp = await client.post(
            "/api/v1/sync/push",
            headers={"Authorization": "Bearer b"},
            json={
                "operations": [
                    {
                        "entity_type": "farms",
                        "id": farm_id,
                        "operation": "create",
                        "payload": {"name": "Farm B collision"},
                    }
                ]
            },
        )
        result = resp.json()["results"][0]
        assert result["status"] == "error"
        assert result["error_code"] == "conflict"

        list_resp = await client.get(
            "/api/v1/farms", headers={"Authorization": "Bearer b"}
        )
        assert len(list_resp.json()["items"]) == 0


@pytest.mark.asyncio
async def test_push_validation_error_does_not_fail_batch(client: AsyncClient) -> None:
    """One bad item in a batch errors on its own result; the rest commit."""
    uid = f"farmer_{uuid4()}"
    good_id = str(uuid4())
    bad_id = str(uuid4())

    with _auth(uid):
        resp = await client.post(
            "/api/v1/sync/push",
            headers={"Authorization": "Bearer t"},
            json={
                "operations": [
                    {
                        "entity_type": "farms",
                        "id": good_id,
                        "operation": "create",
                        "payload": {"name": "Good Farm"},
                    },
                    {
                        "entity_type": "crops",
                        "id": bad_id,
                        "operation": "create",
                        # missing required land_id / crop_catalog_id
                        "payload": {"season": "Rabi"},
                    },
                ]
            },
        )
        assert resp.status_code == 200
        results = resp.json()["results"]
        assert results[0]["status"] == "ok"
        assert results[1]["status"] == "error"
        assert results[1]["error_code"] == "validation_error"

        list_resp = await client.get(
            "/api/v1/farms", headers={"Authorization": "Bearer t"}
        )
        assert len(list_resp.json()["items"]) == 1


@pytest.mark.asyncio
async def test_push_delete_is_idempotent_even_if_unknown(client: AsyncClient) -> None:
    """Deleting an id the server never saw is a no-op success, not a 404 —
    a client that created-then-deleted something entirely offline must not
    have its outbox drain fail."""
    uid = f"farmer_{uuid4()}"
    unknown_id = str(uuid4())

    with _auth(uid):
        resp = await client.post(
            "/api/v1/sync/push",
            headers={"Authorization": "Bearer t"},
            json={
                "operations": [
                    {
                        "entity_type": "farms",
                        "id": unknown_id,
                        "operation": "delete",
                        "payload": {},
                    }
                ]
            },
        )
        assert resp.json()["results"][0]["status"] == "ok"


@pytest.mark.asyncio
async def test_push_rejects_unknown_entity_type(client: AsyncClient) -> None:
    uid = f"farmer_{uuid4()}"
    with _auth(uid):
        resp = await client.post(
            "/api/v1/sync/push",
            headers={"Authorization": "Bearer t"},
            json={
                "operations": [
                    {
                        "entity_type": "not_a_real_entity",
                        "id": str(uuid4()),
                        "operation": "create",
                        "payload": {},
                    }
                ]
            },
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_pull_returns_delta_since_watermark_including_tombstones(
    client: AsyncClient,
) -> None:
    uid = f"farmer_{uuid4()}"

    with _auth(uid):
        pull0 = await client.get(
            "/api/v1/sync/pull", headers={"Authorization": "Bearer t"}
        )
        assert pull0.status_code == 200
        assert pull0.json()["entities"]["farms"]["items"] == []
        watermark = pull0.json()["server_time"]

        create_resp = await client.post(
            "/api/v1/farms",
            headers={"Authorization": "Bearer t"},
            json={"name": "Delta Farm"},
        )
        farm_id = create_resp.json()["id"]

        pull1 = await client.get(
            "/api/v1/sync/pull",
            headers={"Authorization": "Bearer t"},
            params={"since": watermark},
        )
        farms_page = pull1.json()["entities"]["farms"]
        assert len(farms_page["items"]) == 1
        assert farms_page["items"][0]["id"] == farm_id
        watermark2 = pull1.json()["server_time"]

        await client.delete(
            f"/api/v1/farms/{farm_id}", headers={"Authorization": "Bearer t"}
        )

        pull2 = await client.get(
            "/api/v1/sync/pull",
            headers={"Authorization": "Bearer t"},
            params={"since": watermark2},
        )
        farms_page2 = pull2.json()["entities"]["farms"]
        assert len(farms_page2["items"]) == 1
        assert farms_page2["items"][0]["id"] == farm_id
        assert farms_page2["items"][0]["deleted_at"] is not None
        watermark3 = pull2.json()["server_time"]

        pull3 = await client.get(
            "/api/v1/sync/pull",
            headers={"Authorization": "Bearer t"},
            params={"since": watermark3},
        )
        assert pull3.json()["entities"]["farms"]["items"] == []


@pytest.mark.asyncio
async def test_pull_cross_tenant_isolation(client: AsyncClient) -> None:
    uid_a = f"farmer_a_{uuid4()}"
    uid_b = f"farmer_b_{uuid4()}"

    with _auth(uid_a):
        await client.post(
            "/api/v1/farms",
            headers={"Authorization": "Bearer a"},
            json={"name": "Farm A"},
        )

    with _auth(uid_b):
        pull_resp = await client.get(
            "/api/v1/sync/pull", headers={"Authorization": "Bearer b"}
        )
        assert pull_resp.json()["entities"]["farms"]["items"] == []


@pytest.mark.asyncio
async def test_pull_paginates_with_cursor(client: AsyncClient) -> None:
    """A window with more rows than `limit` drains completely across
    repeated calls with the returned `next_cursor`, with no duplicates or
    missing rows, and terminates with `next_cursor: null`."""
    uid = f"farmer_{uuid4()}"

    with _auth(uid):
        for name in ("Farm 1", "Farm 2", "Farm 3"):
            await client.post(
                "/api/v1/farms",
                headers={"Authorization": "Bearer t"},
                json={"name": name},
            )

        seen_ids: set[str] = set()
        cursor = None
        pages = 0
        while True:
            params: dict[str, str | int] = {"limit": 1}
            if cursor:
                params["cursor"] = cursor
            resp = await client.get(
                "/api/v1/sync/pull",
                headers={"Authorization": "Bearer t"},
                params=params,
            )
            data = resp.json()
            for item in data["entities"]["farms"]["items"]:
                assert item["id"] not in seen_ids
                seen_ids.add(item["id"])
            cursor = data["next_cursor"]
            pages += 1
            assert pages < 10  # guard against an infinite loop on a bug
            if cursor is None:
                break

        assert len(seen_ids) == 3
