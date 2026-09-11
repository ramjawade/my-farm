"""Reference data endpoints: list and create crops."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_post_crops_requires_auth(client: AsyncClient) -> None:
    """POST /crops without auth returns 401."""
    resp = await client.post(
        "/api/v1/reference/crops",
        json={"name": "Tomato"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_post_crops_creates_new_crop(client: AsyncClient) -> None:
    """POST /crops with auth creates a new crop."""
    uid = f"farmer_{uuid4()}"
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        resp = await client.post(
            "/api/v1/reference/crops",
            headers={"Authorization": "Bearer test"},
            json={"name": "Tomato"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Tomato"
        assert data["id"]


@pytest.mark.asyncio
async def test_post_crops_case_insensitive_duplicate(client: AsyncClient) -> None:
    """POST /crops with case-insensitive duplicate returns existing crop."""
    uid = f"farmer_{uuid4()}"
    # Unique per run so this doesn't collide with crop names other tests in
    # this file create against the same real test database.
    crop_name = f"okra-{uuid4()}"
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        # Create crop with lowercase
        resp1 = await client.post(
            "/api/v1/reference/crops",
            headers={"Authorization": "Bearer test"},
            json={"name": crop_name},
        )
        assert resp1.status_code == 200
        id1 = resp1.json()["id"]

        # Try to create with uppercase
        resp2 = await client.post(
            "/api/v1/reference/crops",
            headers={"Authorization": "Bearer test"},
            json={"name": crop_name.upper()},
        )
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["id"] == id1
        assert data2["name"] == crop_name  # Returns original name


@pytest.mark.asyncio
async def test_post_crops_empty_name_returns_400(client: AsyncClient) -> None:
    """POST /crops with empty name returns 400."""
    uid = f"farmer_{uuid4()}"
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        resp = await client.post(
            "/api/v1/reference/crops",
            headers={"Authorization": "Bearer test"},
            json={"name": ""},
        )
        assert resp.status_code == 422  # Pydantic validation error


@pytest.mark.asyncio
async def test_get_crops_list(client: AsyncClient) -> None:
    """GET /crops returns the crop catalog."""
    resp = await client.get("/api/v1/reference/crops")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert isinstance(data["items"], list)
