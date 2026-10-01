"""Cursor pagination, filters and sorts for GET /activities and /activities/expenses (#321)."""

import base64
import json
from collections.abc import Awaitable, Callable
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient

from myfarm_api.core.db import get_session_factory
from myfarm_api.core.pagination import (
    InvalidCursorError,
    decode_cursor,
    encode_cursor,
)
from myfarm_api.models import ActivityType
from tests.test_regression_2026_09_30 import _register

Headers = dict[str, str]


# --- cursor codec ---------------------------------------------------------------


def test_cursor_round_trips_key_and_id() -> None:
    raw = encode_cursor("date_desc", "2026-09-30", 42)
    position = decode_cursor(raw, "date_desc")
    assert (position.key, position.id) == ("2026-09-30", 42)


def test_cursor_round_trips_a_null_key() -> None:
    position = decode_cursor(encode_cursor("date_asc", None, 7), "date_asc")
    assert (position.key, position.id) == (None, 7)


def test_cursor_is_url_safe() -> None:
    raw = encode_cursor("updated", "2026-09-30T10:00:00.123456+00:00", 1)
    assert all(c.isalnum() or c in "-_" for c in raw)


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "not-base64!!",
        base64.urlsafe_b64encode(b"not json").decode(),
        base64.urlsafe_b64encode(b'{"s":"x"}').decode(),
        base64.urlsafe_b64encode(b'{"s":"updated","k":5,"id":1}').decode(),
        base64.urlsafe_b64encode(b'{"s":"updated","k":null,"id":"1"}').decode(),
        base64.urlsafe_b64encode(json.dumps([1, 2]).encode()).decode(),
    ],
)
def test_malformed_cursor_is_rejected(raw: str) -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor(raw, "updated")


def test_cursor_for_another_sort_is_rejected() -> None:
    raw = encode_cursor("date_desc", "2026-01-01", 1)
    with pytest.raises(InvalidCursorError):
        decode_cursor(raw, "date_asc")


# --- helpers --------------------------------------------------------------------

Fetch = Callable[..., Awaitable[list[dict[str, Any]]]]


async def _new_type() -> str:
    async with get_session_factory()() as session:
        activity_type = ActivityType(name=f"PagType-{uuid4()}")
        session.add(activity_type)
        await session.commit()
        return str(activity_type.id)


async def _traverse(
    client: AsyncClient, path: str, headers: Headers, limit: int, **params: Any
) -> list[dict[str, Any]]:
    """Follow the cursor to the end, asserting the page contract on the way."""
    items: list[dict[str, Any]] = []
    cursor: str | None = None
    for _ in range(200):
        query = {**params, "limit": limit, **({"cursor": cursor} if cursor else {})}
        resp = await client.get(path, headers=headers, params=query)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert len(body["items"]) <= limit
        assert (body["cursor"] is not None) == body["has_more"]
        items.extend(body["items"])
        cursor = body["cursor"]
        if not body["has_more"]:
            return items
    raise AssertionError("traversal did not terminate")


@pytest.fixture
async def seeded(client: AsyncClient, reference_ids: dict[str, str]) -> dict[str, Any]:
    """One farmer with 23 activities: null and duplicate dates, equal and distinct costs."""
    _, h = await _register(client)
    farm = await client.post("/api/v1/farms", headers=h, json={"name": "F"})
    land = await client.post(
        "/api/v1/lands", headers=h, json={"name": "L", "farm_id": farm.json()["id"]}
    )
    land_id = land.json()["id"]
    other_type = await _new_type()
    dates: list[str | None] = [
        "2026-03-01", "2026-03-01", "2026-03-01", "2026-03-02", "2026-02-28", None, None,
        "2026-03-05", "2026-03-05", "2026-01-15", None, "2026-03-09", "2026-03-09",
        "2026-03-09", "2026-04-01", "2026-02-01", None, "2026-03-03", "2026-03-03",
        "2026-05-05", "2026-05-05", "2026-01-01", "2026-06-06",
    ]  # fmt: skip
    created: list[dict[str, Any]] = []
    for i, date in enumerate(dates):
        payload: dict[str, Any] = {
            "activity_type_id": other_type if i % 4 == 0 else reference_ids["activity_type_id"],
            "status": "Completed" if i % 3 == 0 else "Scheduled",
            "season": "Kharif" if i % 2 else "Rabi",
        }
        if date:
            payload["date"] = date
        if i % 5 < 2:
            payload["land_id"] = land_id
        resp = await client.post("/api/v1/activities", headers=h, json=payload)
        assert resp.status_code == 201, resp.text
        created.append(resp.json())
    # Costs: several activities share 100 (ties), a few differ, most have none.
    for index, amount in {0: "100", 1: "100", 2: "100", 5: "250.50", 9: "75", 12: "100"}.items():
        exp = await client.post(
            f"/api/v1/activities/{created[index]['id']}/expenses",
            headers=h,
            json={"expense_category_id": reference_ids["expense_category_id"], "amount": amount},
        )
        assert exp.status_code == 201, exp.text
    return {"h": h, "created": created, "other_type": other_type, "land_id": land_id}


# --- traversal per sort ---------------------------------------------------------


@pytest.mark.parametrize("sort", [None, "date_asc", "date_desc", "cost_desc"])
@pytest.mark.parametrize("limit", [1, 4, 7, 100])
async def test_traversal_returns_every_row_once_in_sort_order(
    client: AsyncClient, seeded: dict[str, Any], sort: str | None, limit: int
) -> None:
    h = seeded["h"]
    params = {"sort": sort} if sort else {}
    paged = await _traverse(client, "/api/v1/activities", h, limit, **params)
    everything = (
        await client.get("/api/v1/activities", headers=h, params={**params, "limit": 100})
    ).json()["items"]
    ids = [a["id"] for a in paged]
    assert len(ids) == len(set(ids)) == 23
    assert ids == [a["id"] for a in everything]


async def test_date_orders_put_undated_last_with_id_tiebreak(
    client: AsyncClient, seeded: dict[str, Any]
) -> None:
    h = seeded["h"]
    desc = await _traverse(client, "/api/v1/activities", h, 5, sort="date_desc")
    dated = [a for a in desc if a["date"]]
    undated = [a for a in desc if not a["date"]]
    assert desc == dated + undated and len(undated) == 4
    assert [a["date"] for a in dated] == sorted((a["date"] for a in dated), reverse=True)
    assert [a["id"] for a in undated] == sorted((a["id"] for a in undated), reverse=True)
    asc = await _traverse(client, "/api/v1/activities", h, 5, sort="date_asc")
    assert [a["id"] for a in asc if not a["date"]] == sorted(a["id"] for a in undated)


async def test_cost_order_is_by_expense_total_then_id(
    client: AsyncClient, seeded: dict[str, Any]
) -> None:
    h, created = seeded["h"], seeded["created"]
    page = await _traverse(client, "/api/v1/activities", h, 3, sort="cost_desc")
    ids = [a["id"] for a in page]
    assert ids[0] == created[5]["id"]  # 250.50
    hundred = {created[i]["id"] for i in (0, 1, 2, 12)}
    assert set(ids[1:5]) == hundred and ids[1:5] == sorted(hundred, reverse=True)
    assert ids[5] == created[9]["id"]  # 75
    assert ids[6:] == sorted(ids[6:], reverse=True)  # zero-cost rows, id descending


async def test_deleted_expenses_do_not_count_towards_cost_order(
    client: AsyncClient, seeded: dict[str, Any], reference_ids: dict[str, str]
) -> None:
    h, created = seeded["h"], seeded["created"]
    big = await client.post(
        f"/api/v1/activities/{created[20]['id']}/expenses",
        headers=h,
        json={"expense_category_id": reference_ids["expense_category_id"], "amount": "9999"},
    )
    first = (await client.get("/api/v1/activities?sort=cost_desc&limit=1", headers=h)).json()
    assert first["items"][0]["id"] == created[20]["id"]
    await client.delete(
        f"/api/v1/activities/{created[20]['id']}/expenses/{big.json()['id']}", headers=h
    )
    first = (await client.get("/api/v1/activities?sort=cost_desc&limit=1", headers=h)).json()
    assert first["items"][0]["id"] == created[5]["id"]


# --- filters --------------------------------------------------------------------


async def test_filters_apply_across_pages(client: AsyncClient, seeded: dict[str, Any]) -> None:
    h = seeded["h"]
    expected_type = 6  # indexes 0,4,8,12,16,20 use the extra activity type
    by_type = await _traverse(
        client, "/api/v1/activities", h, 2, activity_type_id=seeded["other_type"]
    )
    assert len(by_type) == expected_type
    assert {a["activity_type_id"] for a in by_type} == {int(seeded["other_type"])}

    by_land = await _traverse(client, "/api/v1/activities", h, 3, land_id=seeded["land_id"])
    assert len(by_land) == sum(1 for i in range(23) if i % 5 < 2)

    by_season = await _traverse(client, "/api/v1/activities", h, 4, season="Kharif")
    assert len(by_season) == 11 and {a["season"] for a in by_season} == {"Kharif"}

    combined = await _traverse(
        client, "/api/v1/activities", h, 2, status="Completed", season="Rabi", sort="date_desc"
    )
    assert all(a["status"] == "Completed" and a["season"] == "Rabi" for a in combined)


# --- contract edges -------------------------------------------------------------


async def test_unlimited_default_returns_everything_with_no_cursor(
    client: AsyncClient, seeded: dict[str, Any]
) -> None:
    body = (await client.get("/api/v1/activities", headers=seeded["h"])).json()
    assert len(body["items"]) == 23
    assert body["cursor"] is None and body["has_more"] is False


async def test_bad_cursor_is_422(client: AsyncClient, seeded: dict[str, Any]) -> None:
    h = seeded["h"]
    assert (await client.get("/api/v1/activities?cursor=garbage", headers=h)).status_code == 422
    other_sort = encode_cursor("date_desc", "2026-01-01", 1)
    resp = await client.get("/api/v1/activities", headers=h, params={"cursor": other_sort})
    assert resp.status_code == 422


async def test_changes_during_traversal_never_repeat_rows(
    client: AsyncClient, seeded: dict[str, Any], reference_ids: dict[str, str]
) -> None:
    h, created = seeded["h"], seeded["created"]
    first = (await client.get("/api/v1/activities?limit=5", headers=h)).json()
    seen = {a["id"] for a in first["items"]}
    # Edit an already-returned row (bumps updated_at) and add a new one mid-traversal.
    await client.patch(f"/api/v1/activities/{created[0]['id']}", headers=h, json={"notes": "x"})
    await client.post(
        "/api/v1/activities",
        headers=h,
        json={"activity_type_id": reference_ids["activity_type_id"]},
    )
    cursor = first["cursor"]
    while cursor:
        params = {"limit": 5, "cursor": cursor}
        page = (await client.get("/api/v1/activities", headers=h, params=params)).json()
        ids = {a["id"] for a in page["items"]}
        assert not ids & seen
        seen |= ids
        cursor = page["cursor"]


async def test_other_farmers_rows_never_leak(client: AsyncClient, seeded: dict[str, Any]) -> None:
    _, other = await _register(client)
    body = (await client.get("/api/v1/activities", headers=other)).json()
    assert body["items"] == [] and body["has_more"] is False
    # A cursor issued to one farmer yields only the other farmer's (empty) rows.
    cursor = (await client.get("/api/v1/activities?limit=2", headers=seeded["h"])).json()["cursor"]
    resp = await client.get("/api/v1/activities", headers=other, params={"cursor": cursor})
    assert resp.json()["items"] == []


# --- expenses -------------------------------------------------------------------


@pytest.fixture
async def with_expenses(
    client: AsyncClient, reference_ids: dict[str, str]
) -> tuple[Headers, list[dict[str, Any]]]:
    _, h = await _register(client)
    act = await client.post(
        "/api/v1/activities",
        headers=h,
        json={"activity_type_id": reference_ids["activity_type_id"]},
    )
    expenses = []
    for i in range(23):
        resp = await client.post(
            f"/api/v1/activities/{act.json()['id']}/expenses",
            headers=h,
            json={
                "expense_category_id": reference_ids["expense_category_id"],
                "amount": str(10 + i),
            },
        )
        expenses.append(resp.json())
    return h, expenses


async def test_expenses_limit_is_honoured_and_traversal_is_complete(
    client: AsyncClient, with_expenses: tuple[Headers, list[dict[str, Any]]]
) -> None:
    h, expenses = with_expenses
    first = (await client.get("/api/v1/activities/expenses?limit=10", headers=h)).json()
    assert len(first["items"]) == 10 and first["has_more"] and first["cursor"]
    paged = await _traverse(client, "/api/v1/activities/expenses", h, 7)
    assert sorted(e["id"] for e in paged) == sorted(e["id"] for e in expenses)
    assert len({e["id"] for e in paged}) == 23
    updated = [(e["updated_at"], e["id"]) for e in paged]
    assert updated == sorted(updated, reverse=True)


async def test_expenses_exclude_deleted_and_isolate_tenants(
    client: AsyncClient, with_expenses: tuple[Headers, list[dict[str, Any]]]
) -> None:
    h, expenses = with_expenses
    victim = expenses[3]
    await client.delete(
        f"/api/v1/activities/{victim['activity_id']}/expenses/{victim['id']}", headers=h
    )
    paged = await _traverse(client, "/api/v1/activities/expenses", h, 6)
    assert victim["id"] not in {e["id"] for e in paged} and len(paged) == 22
    _, other = await _register(client)
    assert (await client.get("/api/v1/activities/expenses", headers=other)).json()["items"] == []


async def test_expenses_bad_cursor_is_422(client: AsyncClient) -> None:
    _, h = await _register(client)
    resp = await client.get("/api/v1/activities/expenses?cursor=garbage", headers=h)
    assert resp.status_code == 422
