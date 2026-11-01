"""Sale activities: sale figures on the activity, validation by status, tenancy, filters."""

from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient
from sqlalchemy import select

from myfarm_api.core.db import get_session_factory
from myfarm_api.models import ActivityType

HEADERS = {"Authorization": "Bearer test"}
FIGURES = {
    "sale_quantity": "12",
    "sale_unit": "crates",
    "sale_rate": "1250",
    "sale_amount": "15000",
    "sale_buyer": "Nashik APMC",
}


def _as(uid: str) -> Any:
    return patch.object(
        firebase_auth, "verify_id_token", return_value={"uid": uid, "phone_number": None}
    )


async def _sale_type_id() -> int:
    async with get_session_factory()() as session:
        found = await session.scalar(select(ActivityType.id).where(ActivityType.name == "Sale"))
    assert found is not None, "Sale activity type is seeded by migration 0003"
    return int(found)


async def _make_crop(client: AsyncClient, reference_ids: dict[str, str]) -> int:
    farm = await client.post("/api/v1/farms", headers=HEADERS, json={"name": "F", "state": "MH"})
    land = await client.post(
        "/api/v1/lands", headers=HEADERS, json={"name": "L", "farm_id": str(farm.json()["id"])}
    )
    crop = await client.post(
        "/api/v1/crops",
        headers=HEADERS,
        json={
            "name": "Tomato",
            "land_id": str(land.json()["id"]),
            "crop_catalog_id": reference_ids["crop_catalog_id"],
        },
    )
    assert crop.status_code == 201
    return int(crop.json()["id"])


async def _post(client: AsyncClient, body: dict[str, Any]) -> Any:
    return await client.post("/api/v1/activities", headers=HEADERS, json=body)


def _fields(resp: Any) -> set[str]:
    """The field named in the problem-details title ("sale_unit: Required ...")."""
    return {resp.json()["title"].split(":")[0]}


@pytest.mark.asyncio
async def test_completed_sale_saved_with_figures(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    sale_type = await _sale_type_id()
    with _as(f"farmer_{uuid4()}"):
        crop_id = await _make_crop(client, reference_ids)
        resp = await _post(
            client,
            {
                "activity_type_id": sale_type,
                "crop_id": crop_id,
                "date": "2026-10-02",
                "status": "Completed",
                **FIGURES,
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["sale_unit"] == "crates"
        assert float(body["sale_amount"]) == 15000
        assert body["sale_buyer"] == "Nashik APMC"


@pytest.mark.asyncio
async def test_completed_sale_requires_crop_and_every_figure(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    sale_type = await _sale_type_id()
    with _as(f"farmer_{uuid4()}"):
        crop_id = await _make_crop(client, reference_ids)
        base = {"activity_type_id": sale_type, "date": "2026-10-02", "status": "Completed"}

        no_crop = await _post(client, {**base, **FIGURES})
        assert no_crop.status_code == 422
        assert _fields(no_crop) == {"crop_id"}

        nothing = await _post(client, {**base, "crop_id": crop_id})
        assert nothing.status_code == 422
        assert _fields(nothing) == {"sale_quantity"}

        for missing in ("sale_quantity", "sale_unit", "sale_rate", "sale_amount"):
            partial = {k: v for k, v in FIGURES.items() if k != missing}
            resp = await _post(client, {**base, "crop_id": crop_id, **partial})
            assert resp.status_code == 422, missing
            assert _fields(resp) == {missing}


@pytest.mark.asyncio
async def test_figures_must_be_above_zero(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    sale_type = await _sale_type_id()
    with _as(f"farmer_{uuid4()}"):
        crop_id = await _make_crop(client, reference_ids)
        resp = await _post(
            client,
            {
                "activity_type_id": sale_type,
                "crop_id": crop_id,
                "status": "Scheduled",
                "sale_quantity": "0",
            },
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_planned_sale_without_figures_then_complete(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    sale_type = await _sale_type_id()
    with _as(f"farmer_{uuid4()}"):
        crop_id = await _make_crop(client, reference_ids)
        planned = await _post(
            client,
            {
                "activity_type_id": sale_type,
                "crop_id": crop_id,
                "date": "2030-01-01",
                "status": "Scheduled",
            },
        )
        assert planned.status_code == 201
        assert planned.json()["sale_amount"] is None
        activity_id = planned.json()["id"]
        url = f"/api/v1/activities/{activity_id}"

        # Mark done without figures is refused.
        refused = await client.patch(url, headers=HEADERS, json={"status": "Completed"})
        assert refused.status_code == 422

        # Figures and status together succeed; figures already saved also count.
        done = await client.patch(url, headers=HEADERS, json={"status": "Completed", **FIGURES})
        assert done.status_code == 200
        assert done.json()["status"] == "Completed"
        assert float(done.json()["sale_amount"]) == 15000

        # A later status-only change keeps working because the figures are stored.
        again = await client.patch(url, headers=HEADERS, json={"notes": "paid in cash"})
        assert again.status_code == 200
        assert again.json()["notes"] == "paid in cash"

        # Updating the history path with Decimal values did not break the activity.
        history = await client.get(f"{url}/history", headers=HEADERS)
        assert history.status_code == 200


@pytest.mark.asyncio
async def test_figures_only_on_sale_type(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    with _as(f"farmer_{uuid4()}"):
        resp = await _post(
            client,
            {"activity_type_id": int(reference_ids["activity_type_id"]), **FIGURES},
        )
        assert resp.status_code == 422
        assert "sale_quantity" in _fields(resp)


@pytest.mark.asyncio
async def test_changing_type_away_from_sale_clears_figures(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    sale_type = await _sale_type_id()
    with _as(f"farmer_{uuid4()}"):
        crop_id = await _make_crop(client, reference_ids)
        created = await _post(
            client,
            {
                "activity_type_id": sale_type,
                "crop_id": crop_id,
                "status": "Completed",
                **FIGURES,
            },
        )
        assert created.status_code == 201
        url = f"/api/v1/activities/{created.json()['id']}"

        # Sending figures along with a non-Sale type is refused.
        refused = await client.patch(
            url,
            headers=HEADERS,
            json={"activity_type_id": int(reference_ids["activity_type_id"]), **FIGURES},
        )
        assert refused.status_code == 422

        moved = await client.patch(
            url, headers=HEADERS, json={"activity_type_id": int(reference_ids["activity_type_id"])}
        )
        assert moved.status_code == 200
        body = moved.json()
        for field in FIGURES:
            assert body[field] is None


@pytest.mark.asyncio
async def test_sales_are_tenant_scoped_and_filterable(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    sale_type = await _sale_type_id()
    with _as(f"farmer_{uuid4()}"):
        crop_id = await _make_crop(client, reference_ids)
        other_crop = await _make_crop(client, reference_ids)
        mine = await _post(
            client,
            {"activity_type_id": sale_type, "crop_id": crop_id, "status": "Completed", **FIGURES},
        )
        assert mine.status_code == 201
        await _post(
            client,
            {
                "activity_type_id": sale_type,
                "crop_id": other_crop,
                "status": "Completed",
                **FIGURES,
            },
        )
        await _post(
            client, {"activity_type_id": int(reference_ids["activity_type_id"]), "crop_id": crop_id}
        )
        listed = await client.get(
            f"/api/v1/activities?activity_type_id={sale_type}&crop_id={crop_id}", headers=HEADERS
        )
        assert listed.status_code == 200
        items = listed.json()["items"]
        assert [i["id"] for i in items] == [mine.json()["id"]]
        mine_id = mine.json()["id"]

    with _as(f"farmer_{uuid4()}"):
        stranger = await client.get(f"/api/v1/activities/{mine_id}", headers=HEADERS)
        assert stranger.status_code == 404


@pytest.mark.asyncio
async def test_crop_sales_routes_are_gone(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    with _as(f"farmer_{uuid4()}"):
        crop_id = await _make_crop(client, reference_ids)
        assert (
            await client.get(f"/api/v1/crops/{crop_id}/sales", headers=HEADERS)
        ).status_code == 404
