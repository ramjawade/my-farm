"""Cross-tenant tests for crop endpoints."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_list_crops(client: AsyncClient, reference_ids: dict[str, str]) -> None:
    """Create and list crops for one farmer."""
    uid = f"farmer_{uuid4()}"

    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        # Create a farm and land first (crops belong to lands)
        farm_resp = await client.post(
            "/api/v1/farms",
            headers={"Authorization": "Bearer test"},
            json={"name": "Test Farm", "state": "Punjab"},
        )
        farm_id = farm_resp.json()["id"]

        land_resp = await client.post(
            "/api/v1/lands",
            headers={"Authorization": "Bearer test"},
            json={"name": "Test Land", "farm_id": str(farm_id)},
        )
        land_id = land_resp.json()["id"]

        crop_catalog_id = reference_ids["crop_catalog_id"]

        # Create two crops
        crop1 = await client.post(
            "/api/v1/crops",
            headers={"Authorization": "Bearer test"},
            json={
                "name": "Wheat",
                "land_id": str(land_id),
                "crop_catalog_id": crop_catalog_id,
                "season": "Rabi",
            },
        )
        assert crop1.status_code == 201
        crop1_data = crop1.json()
        assert crop1_data["season"] == "Rabi"

        crop2 = await client.post(
            "/api/v1/crops",
            headers={"Authorization": "Bearer test"},
            json={"land_id": str(land_id), "crop_catalog_id": crop_catalog_id},
        )
        assert crop2.status_code == 201

        # List crops
        list_resp = await client.get(
            "/api/v1/crops", headers={"Authorization": "Bearer test"}
        )
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        assert len(list_data["items"]) == 2
        assert list_data["has_more"] is False


@pytest.mark.asyncio
async def test_cross_tenant_cannot_access_other_crop(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """Farmer A cannot access Farmer B's crop."""
    uid_a = f"farmer_a_{uuid4()}"
    uid_b = f"farmer_b_{uuid4()}"
    crop_catalog_id = reference_ids["crop_catalog_id"]

    # Farmer A creates a farm, land, and crop
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

        land_resp = await client.post(
            "/api/v1/lands",
            headers={"Authorization": "Bearer token_a"},
            json={"name": "Land A", "farm_id": str(farm_a_id)},
        )
        land_a_id = land_resp.json()["id"]

        resp_a = await client.post(
            "/api/v1/crops",
            headers={"Authorization": "Bearer token_a"},
            json={"land_id": str(land_a_id), "crop_catalog_id": crop_catalog_id},
        )
        assert resp_a.status_code == 201
        crop_a_id = resp_a.json()["id"]

    # Farmer B tries to access Farmer A's crop — should get 404
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid_b, "phone_number": None},
    ):
        resp_b = await client.get(
            f"/api/v1/crops/{crop_a_id}",
            headers={"Authorization": "Bearer token_b"},
        )
        assert resp_b.status_code == 404

        # Farmer B's list should be empty (no crops for this tenant)
        list_resp = await client.get(
            "/api/v1/crops", headers={"Authorization": "Bearer token_b"}
        )
        assert list_resp.status_code == 200
        assert len(list_resp.json()["items"]) == 0


@pytest.mark.asyncio
async def test_update_and_delete_crop(client: AsyncClient, reference_ids: dict[str, str]) -> None:
    """Update and soft-delete a crop."""
    uid = f"farmer_{uuid4()}"
    crop_catalog_id = reference_ids["crop_catalog_id"]

    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        # Create farm, land, and crop
        farm_resp = await client.post(
            "/api/v1/farms",
            headers={"Authorization": "Bearer test"},
            json={"name": "Test Farm", "state": "Punjab"},
        )
        farm_id = farm_resp.json()["id"]

        land_resp = await client.post(
            "/api/v1/lands",
            headers={"Authorization": "Bearer test"},
            json={"name": "Test Land", "farm_id": str(farm_id)},
        )
        land_id = land_resp.json()["id"]

        create_resp = await client.post(
            "/api/v1/crops",
            headers={"Authorization": "Bearer test"},
            json={"land_id": str(land_id), "crop_catalog_id": crop_catalog_id},
        )
        crop_id = create_resp.json()["id"]

        # Update crop
        update_resp = await client.patch(
            f"/api/v1/crops/{crop_id}",
            headers={"Authorization": "Bearer test"},
            json={"season": "Kharif"},
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["season"] == "Kharif"

        # Soft-delete
        delete_resp = await client.delete(
            f"/api/v1/crops/{crop_id}",
            headers={"Authorization": "Bearer test"},
        )
        assert delete_resp.status_code == 204

        # Crop should no longer appear in list
        list_resp = await client.get(
            "/api/v1/crops", headers={"Authorization": "Bearer test"}
        )
        assert len(list_resp.json()["items"]) == 0

        # Direct GET should also return 404 (soft-deleted)
        get_resp = await client.get(
            f"/api/v1/crops/{crop_id}",
            headers={"Authorization": "Bearer test"},
        )
        assert get_resp.status_code == 404
