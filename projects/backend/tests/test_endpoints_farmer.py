"""Cross-tenant tests for farmer endpoints — the load-bearing safety layer."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_me_jit_provisions_farmer(client: AsyncClient) -> None:
    """GET /api/v1/me creates a farmer row on first call."""
    uid = f"firebase_user_{uuid4()}"

    # Mock Firebase verification to return this UID
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        # First call: no farmer exists yet, should create one
        response = await client.get("/api/v1/me", headers={"Authorization": "Bearer test"})
        assert response.status_code == 200
        body = response.json()
        assert body["auth_uid"] == uid
        assert body["id"]  # has a UUID
        farmer_id = body["id"]

        # Second call: returns the same farmer (idempotent)
        response = await client.get("/api/v1/me", headers={"Authorization": "Bearer test"})
        assert response.status_code == 200
        body = response.json()
        assert body["id"] == farmer_id


@pytest.mark.asyncio
async def test_get_me_rejected_without_token(client: AsyncClient) -> None:
    """GET /api/v1/me without Authorization header returns 401."""
    response = await client.get("/api/v1/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me_rejected_with_invalid_token(client: AsyncClient) -> None:
    """GET /api/v1/me with malformed token returns 401."""
    response = await client.get(
        "/api/v1/me", headers={"Authorization": "Bearer invalid_token"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_cross_tenant_cannot_view_other_farmer(
    client: AsyncClient,
) -> None:
    """Farmer A cannot view Farmer B's profile via /api/v1/me.

    Cross-tenant test: the critical safety check with RLS non-functional on Neon.
    Each farmer's /api/v1/me always returns THEIR own farmer row only,
    never another farmer's.
    """
    uid_a = f"firebase_user_a_{uuid4()}"
    uid_b = f"firebase_user_b_{uuid4()}"

    # Farmer A calls /api/v1/me, gets their own row
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid_a, "phone_number": None},
    ):
        response_a = await client.get(
            "/api/v1/me", headers={"Authorization": "Bearer token_a"}
        )
    assert response_a.status_code == 200
    farmer_a = response_a.json()
    assert farmer_a["auth_uid"] == uid_a

    # Farmer B calls /api/v1/me, gets their own row (different farmer_id)
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid_b, "phone_number": None},
    ):
        response_b = await client.get(
            "/api/v1/me", headers={"Authorization": "Bearer token_b"}
        )
    assert response_b.status_code == 200
    farmer_b = response_b.json()
    assert farmer_b["auth_uid"] == uid_b
    assert farmer_a["id"] != farmer_b["id"]

    # Farmer A's subsequent calls still return Farmer A's data only
    # (the dependency correctly isolates by token, not by any path parameter)
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid_a, "phone_number": None},
    ):
        response_a_again = await client.get(
            "/api/v1/me", headers={"Authorization": "Bearer token_a"}
        )
    assert response_a_again.status_code == 200
    assert response_a_again.json()["auth_uid"] == uid_a
    assert response_a_again.json()["id"] == farmer_a["id"]
