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
    assert "has_more" in data


@pytest.mark.asyncio
async def test_list_expense_categories_no_auth_required(client: AsyncClient) -> None:
    """Expense categories endpoint accessible without auth."""
    resp = await client.get("/api/v1/reference/expense-categories")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert "has_more" in data


@pytest.mark.asyncio
async def test_list_activity_types_no_auth_required(client: AsyncClient) -> None:
    """Activity types endpoint accessible without auth."""
    resp = await client.get("/api/v1/reference/activity-types")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert "has_more" in data


@pytest.mark.asyncio
async def test_crop_catalog_pagination(client: AsyncClient) -> None:
    """Crop catalog supports cursor pagination."""
    resp = await client.get("/api/v1/reference/crops?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert "cursor" in data
    assert "has_more" in data


@pytest.mark.asyncio
async def test_expense_categories_pagination(client: AsyncClient) -> None:
    """Expense categories support cursor pagination."""
    resp = await client.get("/api/v1/reference/expense-categories?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert "cursor" in data
    assert "has_more" in data


@pytest.mark.asyncio
async def test_activity_types_pagination(client: AsyncClient) -> None:
    """Activity types support cursor pagination."""
    resp = await client.get("/api/v1/reference/activity-types?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert "cursor" in data
    assert "has_more" in data
