"""Cross-tenant tests for activity endpoints."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_list_activities(client: AsyncClient) -> None:
    """Create and list activities for one farmer."""
    uid = f"farmer_{uuid4()}"
    activity_type_id = str(uuid4())

    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        # Create two activities
        activity1 = await client.post(
            "/api/v1/activities",
            headers={"Authorization": "Bearer test"},
            json={"activity_type_id": activity_type_id, "date": "2026-09-08"},
        )
        assert activity1.status_code == 201
        activity1_data = activity1.json()
        assert activity1_data["date"] == "2026-09-08"

        activity2 = await client.post(
            "/api/v1/activities",
            headers={"Authorization": "Bearer test"},
            json={
                "activity_type_id": activity_type_id,
                "custom_activity_name": "Custom Activity",
            },
        )
        assert activity2.status_code == 201

        # List activities
        list_resp = await client.get(
            "/api/v1/activities", headers={"Authorization": "Bearer test"}
        )
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        assert len(list_data["items"]) == 2
        assert list_data["has_more"] is False


@pytest.mark.asyncio
async def test_cross_tenant_cannot_access_other_activity(client: AsyncClient) -> None:
    """Farmer A cannot access Farmer B's activity."""
    uid_a = f"farmer_a_{uuid4()}"
    uid_b = f"farmer_b_{uuid4()}"
    activity_type_id = str(uuid4())

    # Farmer A creates an activity
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid_a, "phone_number": None},
    ):
        resp_a = await client.post(
            "/api/v1/activities",
            headers={"Authorization": "Bearer token_a"},
            json={"activity_type_id": activity_type_id},
        )
        assert resp_a.status_code == 201
        activity_a_id = resp_a.json()["id"]

    # Farmer B tries to access Farmer A's activity — should get 404
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid_b, "phone_number": None},
    ):
        resp_b = await client.get(
            f"/api/v1/activities/{activity_a_id}",
            headers={"Authorization": "Bearer token_b"},
        )
        assert resp_b.status_code == 404

        # Farmer B's list should be empty (no activities for this tenant)
        list_resp = await client.get(
            "/api/v1/activities", headers={"Authorization": "Bearer token_b"}
        )
        assert list_resp.status_code == 200
        assert len(list_resp.json()["items"]) == 0


@pytest.mark.asyncio
async def test_update_and_delete_activity(client: AsyncClient) -> None:
    """Update and soft-delete an activity."""
    uid = f"farmer_{uuid4()}"
    activity_type_id = str(uuid4())

    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        # Create activity
        create_resp = await client.post(
            "/api/v1/activities",
            headers={"Authorization": "Bearer test"},
            json={"activity_type_id": activity_type_id, "status": "pending"},
        )
        activity_id = create_resp.json()["id"]

        # Update activity
        update_resp = await client.patch(
            f"/api/v1/activities/{activity_id}",
            headers={"Authorization": "Bearer test"},
            json={"status": "completed"},
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["status"] == "completed"

        # Soft-delete
        delete_resp = await client.delete(
            f"/api/v1/activities/{activity_id}",
            headers={"Authorization": "Bearer test"},
        )
        assert delete_resp.status_code == 204

        # Activity should no longer appear in list
        list_resp = await client.get(
            "/api/v1/activities", headers={"Authorization": "Bearer test"}
        )
        assert len(list_resp.json()["items"]) == 0

        # Direct GET should also return 404 (soft-deleted)
        get_resp = await client.get(
            f"/api/v1/activities/{activity_id}",
            headers={"Authorization": "Bearer test"},
        )
        assert get_resp.status_code == 404
