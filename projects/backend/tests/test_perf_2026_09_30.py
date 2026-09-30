"""Performance-sweep fixes found 2026-09-30 (#312, #316, #317)."""

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.test_regression_2026_09_30 import _activity, _register

EXPECTED_INDEXES = {
    "idx_farm_farmer_id",
    "idx_land_farmer_id",
    "idx_crop_farmer_id",
    "idx_activity_farmer_updated",
    "idx_activity_crop_id",
    "idx_activity_land_id",
    "idx_activity_expense_activity_id",
}


async def test_tenant_and_fk_indexes_exist(db_session: AsyncSession) -> None:  # #312
    rows = await db_session.execute(text("select indexname from pg_indexes"))
    assert EXPECTED_INDEXES <= {r[0] for r in rows}


async def test_all_expenses_excludes_soft_deleted(  # #317
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    _, h = await _register(client)
    aid = await _activity(client, h, reference_ids)
    body = {"expense_category_id": reference_ids["expense_category_id"]}
    kept = await client.post(
        f"/api/v1/activities/{aid}/expenses", headers=h, json={**body, "amount": "100"}
    )
    gone = await client.post(
        f"/api/v1/activities/{aid}/expenses", headers=h, json={**body, "amount": "777"}
    )
    deleted = await client.delete(
        f"/api/v1/activities/{aid}/expenses/{gone.json()['id']}", headers=h
    )
    assert deleted.status_code == 204

    items = (await client.get("/api/v1/activities/expenses", headers=h)).json()["items"]
    assert [e["id"] for e in items] == [kept.json()["id"]]


async def test_summary_single_query_matches_data(  # #316
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    _, h = await _register(client)
    empty = (await client.get("/api/v1/activities/summary", headers=h)).json()
    assert empty == {"total": 0, "completed": 0, "in_progress": 0, "total_expense": 0.0}

    for status in ("Completed", "Scheduled", "Draft", "Cancelled"):
        resp = await client.post(
            "/api/v1/activities",
            headers=h,
            json={"activity_type_id": reference_ids["activity_type_id"], "status": status},
        )
        assert resp.status_code == 201
    aid = resp.json()["id"]
    await client.post(
        f"/api/v1/activities/{aid}/expenses",
        headers=h,
        json={"expense_category_id": reference_ids["expense_category_id"], "amount": "40.5"},
    )
    summary = (await client.get("/api/v1/activities/summary", headers=h)).json()
    assert summary == {"total": 4, "completed": 1, "in_progress": 2, "total_expense": 40.5}


async def test_static_reference_lists_are_cacheable(client: AsyncClient) -> None:  # #316
    for path in ("expense-categories", "seasons", "crop-stages"):
        resp = await client.get(f"/api/v1/reference/{path}")
        assert resp.headers["cache-control"] == "public, max-age=3600", path
    # These can grow through POST, so they must stay uncached.
    for path in ("crops", "activity-types"):
        resp = await client.get(f"/api/v1/reference/{path}")
        assert "cache-control" not in resp.headers, path
