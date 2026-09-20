"""Payload foreign keys must stay inside the caller's tenant (#246).

The base repository scopes the *row being written* to the caller. It says
nothing about ids the caller supplies inside the payload, so every endpoint
accepting a foreign key to a farmer-owned table needs its own check. Neon
gives us no RLS (BACKEND_PLAN.md §11), which makes these the only boundary.
"""

from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient

HEADERS = {"Authorization": "Bearer test"}


def _auth(uid: str):  # type: ignore[no-untyped-def]
    return patch.object(
        firebase_auth, "verify_id_token", return_value={"uid": uid, "phone_number": None}
    )


async def _make_farm_and_land(client: AsyncClient, uid: str) -> tuple[int, int]:
    """Create a farm and a land owned by `uid`."""
    with _auth(uid):
        farm = await client.post("/api/v1/farms", headers=HEADERS, json={"name": f"farm-{uuid4()}"})
        assert farm.status_code in (200, 201), farm.text
        farm_id = int(farm.json()["id"])
        land = await client.post(
            "/api/v1/lands",
            headers=HEADERS,
            json={"farm_id": farm_id, "name": f"land-{uuid4()}"},
        )
        assert land.status_code in (200, 201), land.text
        return farm_id, int(land.json()["id"])


# ------------------------------------------------------------- activities


@pytest.mark.asyncio
async def test_activity_create_rejects_foreign_land(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    _, victim_land = await _make_farm_and_land(client, f"victim_{uuid4()}")
    with _auth(f"attacker_{uuid4()}"):
        resp = await client.post(
            "/api/v1/activities",
            headers=HEADERS,
            json={
                "activity_type_id": int(reference_ids["activity_type_id"]),
                "land_id": victim_land,
            },
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_activity_create_rejects_foreign_crop(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    victim = f"victim_{uuid4()}"
    _, victim_land = await _make_farm_and_land(client, victim)
    with _auth(victim):
        crop = await client.post(
            "/api/v1/crops",
            headers=HEADERS,
            json={
                "land_id": victim_land,
                "crop_catalog_id": int(reference_ids["crop_catalog_id"]),
            },
        )
        assert crop.status_code in (200, 201), crop.text
        victim_crop = int(crop.json()["id"])

    with _auth(f"attacker_{uuid4()}"):
        resp = await client.post(
            "/api/v1/activities",
            headers=HEADERS,
            json={
                "activity_type_id": int(reference_ids["activity_type_id"]),
                "crop_id": victim_crop,
            },
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_activity_create_rejects_foreign_parent_activity(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    victim = f"victim_{uuid4()}"
    with _auth(victim):
        parent = await client.post(
            "/api/v1/activities",
            headers=HEADERS,
            json={"activity_type_id": int(reference_ids["activity_type_id"])},
        )
        assert parent.status_code in (200, 201), parent.text
        victim_activity = int(parent.json()["id"])

    with _auth(f"attacker_{uuid4()}"):
        resp = await client.post(
            "/api/v1/activities",
            headers=HEADERS,
            json={
                "activity_type_id": int(reference_ids["activity_type_id"]),
                "parent_activity_id": victim_activity,
            },
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_activity_update_rejects_foreign_land(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    _, victim_land = await _make_farm_and_land(client, f"victim_{uuid4()}")
    attacker = f"attacker_{uuid4()}"
    with _auth(attacker):
        own = await client.post(
            "/api/v1/activities",
            headers=HEADERS,
            json={"activity_type_id": int(reference_ids["activity_type_id"])},
        )
        assert own.status_code in (200, 201), own.text
        resp = await client.patch(
            f"/api/v1/activities/{own.json()['id']}",
            headers=HEADERS,
            json={"land_id": victim_land},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_activity_create_accepts_own_land(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """The check must not break the ordinary case."""
    owner = f"owner_{uuid4()}"
    _, own_land = await _make_farm_and_land(client, owner)
    with _auth(owner):
        resp = await client.post(
            "/api/v1/activities",
            headers=HEADERS,
            json={
                "activity_type_id": int(reference_ids["activity_type_id"]),
                "land_id": own_land,
            },
        )
    assert resp.status_code == 201
    assert resp.json()["land_id"] == own_land


# ------------------------------------------------------------------ lands


@pytest.mark.asyncio
async def test_land_create_rejects_foreign_farm(client: AsyncClient) -> None:
    victim_farm, _ = await _make_farm_and_land(client, f"victim_{uuid4()}")
    with _auth(f"attacker_{uuid4()}"):
        resp = await client.post(
            "/api/v1/lands",
            headers=HEADERS,
            json={"farm_id": victim_farm, "name": "stolen"},
        )
    assert resp.status_code == 404





# ------------------------------------------------------------------ crops


@pytest.mark.asyncio
async def test_crop_create_rejects_foreign_land(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    _, victim_land = await _make_farm_and_land(client, f"victim_{uuid4()}")
    with _auth(f"attacker_{uuid4()}"):
        resp = await client.post(
            "/api/v1/crops",
            headers=HEADERS,
            json={
                "land_id": victim_land,
                "crop_catalog_id": int(reference_ids["crop_catalog_id"]),
            },
        )
    assert resp.status_code == 404


# ------------------------------------------------- reparenting is not exposed
# `LandUpdate` has no `farm_id` and `CropUpdate` has no `land_id`, so these
# endpoints cannot move a row to another parent at all — Pydantic drops the
# field before the router sees it. That is a stronger guarantee than a runtime
# check, but only while it holds: if someone adds the field to the schema,
# these tests fail and point back here, and the endpoint then needs an
# `ensure_owned` call like activity update has.


@pytest.mark.asyncio
async def test_land_update_ignores_farm_id(client: AsyncClient) -> None:
    victim_farm, _ = await _make_farm_and_land(client, f"victim_{uuid4()}")
    attacker = f"attacker_{uuid4()}"
    attacker_farm, attacker_land = await _make_farm_and_land(client, attacker)
    with _auth(attacker):
        resp = await client.patch(
            f"/api/v1/lands/{attacker_land}",
            headers=HEADERS,
            json={"farm_id": victim_farm, "name": "renamed"},
        )
    assert resp.status_code == 200
    assert resp.json()["farm_id"] == attacker_farm, "land was reparented to another tenant"


@pytest.mark.asyncio
async def test_crop_update_ignores_land_id(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    _, victim_land = await _make_farm_and_land(client, f"victim_{uuid4()}")
    attacker = f"attacker_{uuid4()}"
    _, attacker_land = await _make_farm_and_land(client, attacker)
    with _auth(attacker):
        crop = await client.post(
            "/api/v1/crops",
            headers=HEADERS,
            json={
                "land_id": attacker_land,
                "crop_catalog_id": int(reference_ids["crop_catalog_id"]),
            },
        )
        assert crop.status_code in (200, 201), crop.text
        resp = await client.patch(
            f"/api/v1/crops/{crop.json()['id']}",
            headers=HEADERS,
            json={"land_id": victim_land, "label": "renamed"},
        )
    assert resp.status_code == 200
    assert resp.json()["land_id"] == attacker_land, "crop was reparented to another tenant"


def test_update_schemas_do_not_expose_parent_ids() -> None:
    """Canary: adding these fields silently would reopen #246."""
    from myfarm_api.schemas.crop import CropUpdate
    from myfarm_api.schemas.land import LandUpdate

    assert "farm_id" not in LandUpdate.model_fields
    assert "land_id" not in CropUpdate.model_fields
