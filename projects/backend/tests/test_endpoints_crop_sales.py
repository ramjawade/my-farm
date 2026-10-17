"""Tests for crop sale endpoints, including cross-tenant isolation."""

from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient

HEADERS = {"Authorization": "Bearer test"}
SALE = {
    "sold_on": "2026-10-02",
    "quantity": "12",
    "unit": "crates",
    "rate": "1250",
    "amount": "15000",
    "buyer": "Nashik APMC",
}


def _as(uid: str) -> Any:
    return patch.object(
        firebase_auth, "verify_id_token", return_value={"uid": uid, "phone_number": None}
    )


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


@pytest.mark.asyncio
async def test_sale_crud(client: AsyncClient, reference_ids: dict[str, str]) -> None:
    with _as(f"farmer_{uuid4()}"):
        crop_id = await _make_crop(client, reference_ids)
        base = f"/api/v1/crops/{crop_id}/sales"

        first = await client.post(base, headers=HEADERS, json=SALE)
        assert first.status_code == 201
        sale_id = first.json()["id"]
        assert first.json()["unit"] == "crates"
        older = await client.post(
            base, headers=HEADERS, json={**SALE, "sold_on": "2026-09-30", "amount": "11000"}
        )
        assert older.status_code == 201

        listed = (await client.get(base, headers=HEADERS)).json()["items"]
        assert [s["sold_on"] for s in listed] == ["2026-10-02", "2026-09-30"]

        patched = await client.patch(
            f"{base}/{sale_id}", headers=HEADERS, json={"amount": "15500"}
        )
        assert patched.status_code == 200
        assert float(patched.json()["amount"]) == 15500

        assert (await client.delete(f"{base}/{sale_id}", headers=HEADERS)).status_code == 204
        remaining = (await client.get(base, headers=HEADERS)).json()["items"]
        assert len(remaining) == 1
        assert (await client.delete(f"{base}/{sale_id}", headers=HEADERS)).status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad",
    [
        {"quantity": "0"},
        {"rate": "0"},
        {"amount": "0"},
        {"unit": "  "},
        {"sold_on": "not-a-date"},
    ],
)
async def test_sale_validation(
    client: AsyncClient, reference_ids: dict[str, str], bad: dict[str, str]
) -> None:
    with _as(f"farmer_{uuid4()}"):
        crop_id = await _make_crop(client, reference_ids)
        resp = await client.post(
            f"/api/v1/crops/{crop_id}/sales", headers=HEADERS, json={**SALE, **bad}
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_sale_update_rejects_null_required(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    with _as(f"farmer_{uuid4()}"):
        crop_id = await _make_crop(client, reference_ids)
        base = f"/api/v1/crops/{crop_id}/sales"
        sale_id = (await client.post(base, headers=HEADERS, json=SALE)).json()["id"]
        resp = await client.patch(f"{base}/{sale_id}", headers=HEADERS, json={"unit": None})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_cross_tenant_sales_are_not_found(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    with _as(f"owner_{uuid4()}"):
        crop_id = await _make_crop(client, reference_ids)
        base = f"/api/v1/crops/{crop_id}/sales"
        sale_id = (await client.post(base, headers=HEADERS, json=SALE)).json()["id"]

    with _as(f"intruder_{uuid4()}"):
        assert (await client.get(base, headers=HEADERS)).status_code == 404
        assert (await client.post(base, headers=HEADERS, json=SALE)).status_code == 404
        one = f"{base}/{sale_id}"
        assert (await client.patch(one, headers=HEADERS, json={"unit": "kg"})).status_code == 404
        assert (await client.delete(one, headers=HEADERS)).status_code == 404
