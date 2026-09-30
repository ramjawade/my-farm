"""Regressions found by the 2026-09-30 smoke test (#302-#309)."""

from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient

from myfarm_api.core.config import get_settings

BIG = 99999999999999999999  # > int64


def _phone() -> str:
    return f"9{uuid4().int % 1_000_000_000:09d}"


async def _register(client: AsyncClient, pin: str = "1234") -> tuple[str, dict[str, str]]:
    phone = _phone()
    resp = await client.post(
        "/api/v1/auth/register",
        json={"phone": phone, "full_name": "Test Farmer", "pin": pin},
    )
    assert resp.status_code == 201, resp.text
    return phone, {"Authorization": f"Bearer {resp.json()['token']}"}


async def _farm(client: AsyncClient, headers: dict[str, str]) -> int:
    resp = await client.post("/api/v1/farms", headers=headers, json={"name": "F"})
    assert resp.status_code == 201
    return int(resp.json()["id"])


# --- #302 PATCH null / over-long ------------------------------------------------


@pytest.mark.parametrize("body", [{"name": None}, {"name": "x" * 300}, {"name": "  "}])
async def test_patch_farm_bad_name_is_422(client: AsyncClient, body: dict[str, Any]) -> None:
    _, h = await _register(client)
    farm_id = await _farm(client, h)
    resp = await client.patch(f"/api/v1/farms/{farm_id}", headers=h, json=body)
    assert resp.status_code == 422


async def test_patch_land_null_name_is_422_and_partial_patch_still_works(
    client: AsyncClient,
) -> None:
    _, h = await _register(client)
    farm_id = await _farm(client, h)
    land = await client.post("/api/v1/lands", headers=h, json={"name": "L", "farm_id": farm_id})
    land_id = land.json()["id"]
    assert (
        await client.patch(f"/api/v1/lands/{land_id}", headers=h, json={"name": None})
    ).status_code == 422
    ok = await client.patch(f"/api/v1/lands/{land_id}", headers=h, json={"notes": "n"})
    assert ok.status_code == 200 and ok.json()["name"] == "L"


# --- #303 oversized ids ---------------------------------------------------------


@pytest.mark.parametrize("resource", ["farms", "lands", "crops", "activities"])
async def test_oversized_path_id_is_422(client: AsyncClient, resource: str) -> None:
    _, h = await _register(client)
    resp = await client.get(f"/api/v1/{resource}/{BIG}", headers=h)
    assert resp.status_code == 422


async def test_oversized_body_id_is_422(client: AsyncClient) -> None:
    _, h = await _register(client)
    resp = await client.post("/api/v1/lands", headers=h, json={"name": "L", "farm_id": BIG})
    assert resp.status_code == 422


# --- #304 expense amounts -------------------------------------------------------


async def _activity(client: AsyncClient, h: dict[str, str], ref: dict[str, str]) -> int:
    resp = await client.post(
        "/api/v1/activities", headers=h, json={"activity_type_id": ref["activity_type_id"]}
    )
    assert resp.status_code == 201, resp.text
    return int(resp.json()["id"])


@pytest.mark.parametrize("amount", ["-100", "1e30", "10000000000"])
async def test_expense_bad_amount_is_422(
    client: AsyncClient, reference_ids: dict[str, str], amount: str
) -> None:
    _, h = await _register(client)
    aid = await _activity(client, h, reference_ids)
    resp = await client.post(
        f"/api/v1/activities/{aid}/expenses",
        headers=h,
        json={"expense_category_id": reference_ids["expense_category_id"], "amount": amount},
    )
    assert resp.status_code == 422


async def test_expense_with_extra_decimals_is_still_accepted(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    _, h = await _register(client)
    aid = await _activity(client, h, reference_ids)
    resp = await client.post(
        f"/api/v1/activities/{aid}/expenses",
        headers=h,
        json={"expense_category_id": reference_ids["expense_category_id"], "amount": "12.345"},
    )
    assert resp.status_code == 201


# --- #305 foreign key vs duplicate ---------------------------------------------


async def test_unknown_activity_type_is_422_not_409(client: AsyncClient) -> None:
    _, h = await _register(client)
    resp = await client.post("/api/v1/activities", headers=h, json={"activity_type_id": 999999})
    assert resp.status_code == 422
    assert "does not exist" in resp.json()["title"]


async def test_unknown_expense_category_is_422_not_409(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    _, h = await _register(client)
    aid = await _activity(client, h, reference_ids)
    resp = await client.post(
        f"/api/v1/activities/{aid}/expenses",
        headers=h,
        json={"expense_category_id": 999999, "amount": "5"},
    )
    assert resp.status_code == 422


async def test_unknown_crop_catalog_is_422(client: AsyncClient) -> None:
    _, h = await _register(client)
    farm_id = await _farm(client, h)
    land = await client.post("/api/v1/lands", headers=h, json={"name": "L", "farm_id": farm_id})
    resp = await client.post(
        "/api/v1/crops", headers=h, json={"land_id": land.json()["id"], "crop_catalog_id": 999999}
    )
    assert resp.status_code == 422


# --- #306 create validation -----------------------------------------------------


@pytest.mark.parametrize(
    "body",
    [
        {"name": ""},
        {"name": "F", "area": -5},
        {"name": "F", "lat": 999},
        {"name": "F", "lng": -999},
    ],
)
async def test_create_farm_rejects_nonsense(client: AsyncClient, body: dict[str, Any]) -> None:
    _, h = await _register(client)
    assert (await client.post("/api/v1/farms", headers=h, json=body)).status_code == 422


async def test_create_land_rejects_negative_area_and_bad_points(client: AsyncClient) -> None:
    _, h = await _register(client)
    farm_id = await _farm(client, h)
    base = {"name": "L", "farm_id": farm_id}
    for extra in ({"area_sq_m": -10}, {"points": [{"lat": 500, "lng": 500}]}):
        resp = await client.post("/api/v1/lands", headers=h, json={**base, **extra})
        assert resp.status_code == 422


async def test_create_land_accepts_valid_points(client: AsyncClient) -> None:
    _, h = await _register(client)
    farm_id = await _farm(client, h)
    resp = await client.post(
        "/api/v1/lands",
        headers=h,
        json={"name": "L", "farm_id": farm_id, "points": [{"lat": 18.5, "lng": 73.8}]},
    )
    assert resp.status_code == 201 and len(resp.json()["points"]) == 1


async def test_crop_and_activity_dates_must_be_iso(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    _, h = await _register(client)
    bad = await client.post(
        "/api/v1/activities",
        headers=h,
        json={"activity_type_id": reference_ids["activity_type_id"], "date": "garbage"},
    )
    assert bad.status_code == 422
    ok = await client.post(
        "/api/v1/activities",
        headers=h,
        json={"activity_type_id": reference_ids["activity_type_id"], "date": "2026-09-30"},
    )
    assert ok.status_code == 201
    farm_id = await _farm(client, h)
    land = await client.post("/api/v1/lands", headers=h, json={"name": "L", "farm_id": farm_id})
    crop = await client.post(
        "/api/v1/crops",
        headers=h,
        json={
            "land_id": land.json()["id"],
            "crop_catalog_id": reference_ids["crop_catalog_id"],
            "sowing_date": "not-a-date",
        },
    )
    assert crop.status_code == 422


# --- #307 PIN / name ------------------------------------------------------------


@pytest.mark.parametrize("pin", ["1234\n", " 1234", "12\n34"])
async def test_pin_with_whitespace_is_rejected(client: AsyncClient, pin: str) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"phone": _phone(), "full_name": "Test Farmer", "pin": pin},
    )
    assert resp.status_code == 422


async def test_blank_full_name_is_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"phone": _phone(), "full_name": "    ", "pin": "1234"},
    )
    assert resp.status_code == 422


# --- #308 login throttle --------------------------------------------------------


async def _login(client: AsyncClient, phone: str, pin: str) -> Any:
    return await client.post("/api/v1/auth/session", json={"phone": phone, "pin": pin})


async def test_login_locks_after_repeated_wrong_pins(client: AsyncClient) -> None:
    phone, _ = await _register(client)
    limit = get_settings().login_max_failures
    for _ in range(limit):
        assert (await _login(client, phone, "0000")).status_code == 401
    locked = await _login(client, phone, "1234")  # even the right PIN is refused
    assert locked.status_code == 429
    assert int(locked.headers["Retry-After"]) > 0


async def test_successful_login_resets_the_counter(client: AsyncClient) -> None:
    phone, _ = await _register(client)
    limit = get_settings().login_max_failures
    for _ in range(limit - 1):
        await _login(client, phone, "0000")
    assert (await _login(client, phone, "1234")).status_code == 200
    for _ in range(limit - 1):
        assert (await _login(client, phone, "0000")).status_code == 401


async def test_lockout_is_per_phone(client: AsyncClient) -> None:
    phone, _ = await _register(client)
    other, _ = await _register(client)
    for _ in range(get_settings().login_max_failures):
        await _login(client, phone, "0000")
    assert (await _login(client, other, "1234")).status_code == 200


# --- #309 admin token -----------------------------------------------------------

SEED = "/api/v1/admin/seed-reference-data"


async def test_admin_seed_requires_token(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "admin_token", "s3cret")
    assert (await client.post(SEED)).status_code == 401
    assert (await client.post(SEED, headers={"X-Admin-Token": "wrong"})).status_code == 401
    ok = await client.post(SEED, headers={"X-Admin-Token": "s3cret"})
    assert ok.status_code == 200


async def test_admin_disabled_when_token_unset(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "admin_token", "")
    resp = await client.post(SEED, headers={"X-Admin-Token": ""})
    assert resp.status_code == 403


