"""Tests for reference data endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_crop_catalog_no_auth_required(client: AsyncClient) -> None:
    """Reference endpoints don't require authentication."""
    resp = await client.get("/api/v1/reference/crops")
    # Should return 200 even without auth header
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_list_expense_categories_no_auth_required(client: AsyncClient) -> None:
    """Expense categories endpoint accessible without auth."""
    resp = await client.get("/api/v1/reference/expense-categories")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_list_activity_types_no_auth_required(client: AsyncClient) -> None:
    """Activity types endpoint accessible without auth."""
    resp = await client.get("/api/v1/reference/activity-types")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_reference_lists_are_unpaginated(client: AsyncClient) -> None:
    """Reference lists return the whole table in one call — no cursor (#61)."""
    for path in (
        "/api/v1/reference/crops",
        "/api/v1/reference/expense-categories",
        "/api/v1/reference/activity-types",
    ):
        resp = await client.get(path)
        assert resp.status_code == 200
        assert set(resp.json().keys()) == {"items"}
