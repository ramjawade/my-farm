"""Cross-tenant tests for land endpoints."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_list_lands(client: AsyncClient) -> None:
    """Create and list lands for one farmer."""
    uid = f"farmer_{uuid4()}"

    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        # Create a farm first (lands belong to farms)
        farm_resp = await client.post(
            "/api/v1/farms",
            headers={"Authorization": "Bearer test"},
            json={"name": "Test Farm", "state": "Punjab"},
        )
        farm_id = farm_resp.json()["id"]

        # Create two lands
        land1 = await client.post(
            "/api/v1/lands",
            headers={"Authorization": "Bearer test"},
            json={"name": "North Plot", "farm_id": str(farm_id), "area_sq_m": "500.50"},
        )
        assert land1.status_code == 201
        land1_data = land1.json()
        assert land1_data["name"] == "North Plot"

        land2 = await client.post(
            "/api/v1/lands",
            headers={"Authorization": "Bearer test"},
            json={"name": "South Plot", "farm_id": str(farm_id)},
        )
        assert land2.status_code == 201

        # List lands
        list_resp = await client.get(
            "/api/v1/lands", headers={"Authorization": "Bearer test"}
        )
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        assert len(list_data["items"]) == 2


@pytest.mark.asyncio
async def test_cross_tenant_cannot_access_other_land(client: AsyncClient) -> None:
    """Farmer A cannot access Farmer B's land."""
    uid_a = f"farmer_a_{uuid4()}"
    uid_b = f"farmer_b_{uuid4()}"

    # Farmer A creates a farm and land
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid_a, "phone_number": None},
    ):
        farm_resp = await client.post(
            "/api/v1/farms",
            headers={"Authorization": "Bearer token_a"},
            json={"name": "Farm A", "state": "Punjab"},
        )
        farm_a_id = farm_resp.json()["id"]

        resp_a = await client.post(
            "/api/v1/lands",
            headers={"Authorization": "Bearer token_a"},
            json={"name": "Land A", "farm_id": str(farm_a_id)},
        )
        assert resp_a.status_code == 201
        land_a_id = resp_a.json()["id"]

    # Farmer B tries to access Farmer A's land — should get 404
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid_b, "phone_number": None},
    ):
        resp_b = await client.get(
            f"/api/v1/lands/{land_a_id}",
            headers={"Authorization": "Bearer token_b"},
        )
        # 404, not 403 (404 is used per BACKEND_PLAN.md §5.2 to avoid leaking existence)
        assert resp_b.status_code == 404

        # Farmer B's list should be empty (no lands for this tenant)
        list_resp = await client.get(
            "/api/v1/lands", headers={"Authorization": "Bearer token_b"}
        )
        assert list_resp.status_code == 200
        assert len(list_resp.json()["items"]) == 0


@pytest.mark.asyncio
async def test_update_and_delete_land(client: AsyncClient) -> None:
    """Update and soft-delete a land."""
    uid = f"farmer_{uuid4()}"

    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        # Create farm and land
        farm_resp = await client.post(
            "/api/v1/farms",
            headers={"Authorization": "Bearer test"},
            json={"name": "Test Farm", "state": "Punjab"},
        )
        farm_id = farm_resp.json()["id"]

        create_resp = await client.post(
            "/api/v1/lands",
            headers={"Authorization": "Bearer test"},
            json={"name": "Original Name", "farm_id": str(farm_id)},
        )
        land_id = create_resp.json()["id"]

        # Update land
        update_resp = await client.patch(
            f"/api/v1/lands/{land_id}",
            headers={"Authorization": "Bearer test"},
            json={"name": "Updated Name"},
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["name"] == "Updated Name"

        # Soft-delete
        delete_resp = await client.delete(
            f"/api/v1/lands/{land_id}",
            headers={"Authorization": "Bearer test"},
        )
        assert delete_resp.status_code == 204

        # Land should no longer appear in list
        list_resp = await client.get(
            "/api/v1/lands", headers={"Authorization": "Bearer test"}
        )
        assert len(list_resp.json()["items"]) == 0

        # Direct GET should also return 404 (soft-deleted)
        get_resp = await client.get(
            f"/api/v1/lands/{land_id}",
            headers={"Authorization": "Bearer test"},
        )
        assert get_resp.status_code == 404
