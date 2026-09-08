"""Cross-tenant tests for nested activity resources (expenses, attachments)."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_list_activity_expenses(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """Create and list expenses for an activity."""
    uid = f"farmer_{uuid4()}"
    activity_type_id = reference_ids["activity_type_id"]
    expense_category_id = reference_ids["expense_category_id"]

    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        # Create activity
        activity_resp = await client.post(
            "/api/v1/activities",
            headers={"Authorization": "Bearer test"},
            json={"activity_type_id": activity_type_id},
        )
        activity_id = activity_resp.json()["id"]

        # Create two expenses
        expense1 = await client.post(
            f"/api/v1/activities/{activity_id}/expenses",
            headers={"Authorization": "Bearer test"},
            json={
                "expense_category_id": expense_category_id,
                "item_id": "SEED-001",
                "quantity": "10",
                "rate": "50.00",
                "amount": "500.00",
            },
        )
        assert expense1.status_code == 201
        assert expense1.json()["item_id"] == "SEED-001"

        expense2 = await client.post(
            f"/api/v1/activities/{activity_id}/expenses",
            headers={"Authorization": "Bearer test"},
            json={"expense_category_id": expense_category_id, "amount": "250.00"},
        )
        assert expense2.status_code == 201

        # List expenses for this activity
        list_resp = await client.get(
            f"/api/v1/activities/{activity_id}/expenses",
            headers={"Authorization": "Bearer test"},
        )
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        assert len(list_data["items"]) == 2


@pytest.mark.asyncio
async def test_cross_tenant_cannot_access_other_activity_expense(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """Farmer A cannot access Farmer B's activity expense."""
    uid_a = f"farmer_a_{uuid4()}"
    uid_b = f"farmer_b_{uuid4()}"
    activity_type_id = reference_ids["activity_type_id"]
    expense_category_id = reference_ids["expense_category_id"]

    # Farmer A creates an activity and expense
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid_a, "phone_number": None},
    ):
        activity_resp = await client.post(
            "/api/v1/activities",
            headers={"Authorization": "Bearer token_a"},
            json={"activity_type_id": activity_type_id},
        )
        activity_a_id = activity_resp.json()["id"]

        expense_resp = await client.post(
            f"/api/v1/activities/{activity_a_id}/expenses",
            headers={"Authorization": "Bearer token_a"},
            json={"expense_category_id": expense_category_id, "amount": "100.00"},
        )
        assert expense_resp.status_code == 201

        # List should show the expense
        list_resp = await client.get(
            f"/api/v1/activities/{activity_a_id}/expenses",
            headers={"Authorization": "Bearer token_a"},
        )
        assert len(list_resp.json()["items"]) == 1

    # Farmer B tries to access Farmer A's activity — should get 404
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid_b, "phone_number": None},
    ):
        list_resp = await client.get(
            f"/api/v1/activities/{activity_a_id}/expenses",
            headers={"Authorization": "Bearer token_b"},
        )
        assert list_resp.status_code == 404


@pytest.mark.asyncio
async def test_create_and_list_activity_attachments(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """Create and list attachments for an activity."""
    uid = f"farmer_{uuid4()}"
    activity_type_id = reference_ids["activity_type_id"]

    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        # Create activity
        activity_resp = await client.post(
            "/api/v1/activities",
            headers={"Authorization": "Bearer test"},
            json={"activity_type_id": activity_type_id},
        )
        activity_id = activity_resp.json()["id"]

        # Create two attachments
        attachment1 = await client.post(
            f"/api/v1/activities/{activity_id}/attachments",
            headers={"Authorization": "Bearer test"},
            json={
                "storage_key": "s3://bucket/photo-001.jpg",
                "content_type": "image/jpeg",
                "size_bytes": 1024000,
            },
        )
        assert attachment1.status_code == 201
        assert attachment1.json()["storage_key"] == "s3://bucket/photo-001.jpg"

        attachment2 = await client.post(
            f"/api/v1/activities/{activity_id}/attachments",
            headers={"Authorization": "Bearer test"},
            json={"storage_key": "s3://bucket/photo-002.jpg"},
        )
        assert attachment2.status_code == 201

        # List attachments for this activity
        list_resp = await client.get(
            f"/api/v1/activities/{activity_id}/attachments",
            headers={"Authorization": "Bearer test"},
        )
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        assert len(list_data["items"]) == 2


@pytest.mark.asyncio
async def test_cross_tenant_cannot_access_other_activity_attachment(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """Farmer A cannot access Farmer B's activity attachment."""
    uid_a = f"farmer_a_{uuid4()}"
    uid_b = f"farmer_b_{uuid4()}"
    activity_type_id = reference_ids["activity_type_id"]

    # Farmer A creates an activity and attachment
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid_a, "phone_number": None},
    ):
        activity_resp = await client.post(
            "/api/v1/activities",
            headers={"Authorization": "Bearer token_a"},
            json={"activity_type_id": activity_type_id},
        )
        activity_a_id = activity_resp.json()["id"]

        attachment_resp = await client.post(
            f"/api/v1/activities/{activity_a_id}/attachments",
            headers={"Authorization": "Bearer token_a"},
            json={"storage_key": "s3://bucket/photo.jpg"},
        )
        assert attachment_resp.status_code == 201

        # List should show the attachment
        list_resp = await client.get(
            f"/api/v1/activities/{activity_a_id}/attachments",
            headers={"Authorization": "Bearer token_a"},
        )
        assert len(list_resp.json()["items"]) == 1

    # Farmer B tries to access Farmer A's activity — should get 404
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid_b, "phone_number": None},
    ):
        list_resp = await client.get(
            f"/api/v1/activities/{activity_a_id}/attachments",
            headers={"Authorization": "Bearer token_b"},
        )
        assert list_resp.status_code == 404
