"""Cross-tenant tests for activity endpoints."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_list_activities(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """Create and list activities for one farmer."""
    uid = f"farmer_{uuid4()}"
    activity_type_id = reference_ids["activity_type_id"]

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


@pytest.mark.asyncio
async def test_cross_tenant_cannot_access_other_activity(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """Farmer A cannot access Farmer B's activity."""
    uid_a = f"farmer_a_{uuid4()}"
    uid_b = f"farmer_b_{uuid4()}"
    activity_type_id = reference_ids["activity_type_id"]

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
async def test_update_and_delete_activity(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """Update and soft-delete an activity."""
    uid = f"farmer_{uuid4()}"
    activity_type_id = reference_ids["activity_type_id"]

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


@pytest.mark.asyncio
async def test_list_activities_filters_status_sort_and_limit(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """status/sort/limit narrow the list; omitting them keeps the old behavior."""
    uid = f"farmer_{uuid4()}"
    activity_type_id = reference_ids["activity_type_id"]

    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        headers = {"Authorization": "Bearer test"}

        async def make(date: str, status: str) -> None:
            resp = await client.post(
                "/api/v1/activities",
                headers=headers,
                json={"activity_type_id": activity_type_id, "date": date, "status": status},
            )
            assert resp.status_code == 201

        await make("2026-01-01", "Completed")
        await make("2026-02-01", "Completed")
        await make("2026-03-01", "Scheduled")
        await make("2026-04-01", "Draft")

        # No params — unchanged, everything comes back
        all_resp = await client.get("/api/v1/activities", headers=headers)
        assert len(all_resp.json()["items"]) == 4

        # status filter (repeatable) narrows to the matching statuses
        pending_resp = await client.get(
            "/api/v1/activities?status=Scheduled&status=Draft", headers=headers
        )
        pending_items = pending_resp.json()["items"]
        assert len(pending_items) == 2
        assert {a["status"] for a in pending_items} == {"Scheduled", "Draft"}

        # sort + limit: most recent Completed activity, one row
        recent_resp = await client.get(
            "/api/v1/activities?status=Completed&sort=date_desc&limit=1", headers=headers
        )
        recent_items = recent_resp.json()["items"]
        assert len(recent_items) == 1
        assert recent_items[0]["date"] == "2026-02-01"

        # sort ascending, no limit
        asc_resp = await client.get(
            "/api/v1/activities?status=Completed&sort=date_asc", headers=headers
        )
        asc_items = asc_resp.json()["items"]
        assert [a["date"] for a in asc_items] == ["2026-01-01", "2026-02-01"]


@pytest.mark.asyncio
async def test_activities_summary_counts_and_expense(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """GET /activities/summary aggregates counts and total expense server-side."""
    uid = f"farmer_{uuid4()}"
    activity_type_id = reference_ids["activity_type_id"]
    expense_category_id = reference_ids["expense_category_id"]

    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        headers = {"Authorization": "Bearer test"}

        completed = await client.post(
            "/api/v1/activities",
            headers=headers,
            json={"activity_type_id": activity_type_id, "status": "Completed"},
        )
        completed_id = completed.json()["id"]

        await client.post(
            "/api/v1/activities",
            headers=headers,
            json={"activity_type_id": activity_type_id, "status": "Scheduled"},
        )

        expense_resp = await client.post(
            f"/api/v1/activities/{completed_id}/expenses",
            headers=headers,
            json={"expense_category_id": expense_category_id, "amount": "250.00"},
        )
        assert expense_resp.status_code == 201

        summary_resp = await client.get("/api/v1/activities/summary", headers=headers)
        assert summary_resp.status_code == 200
        summary = summary_resp.json()
        assert summary["total"] == 2
        assert summary["completed"] == 1
        assert summary["in_progress"] == 1
        assert summary["total_expense"] == 250.0

        # A soft-deleted expense must drop out of the farm-wide total too.
        expense_id = expense_resp.json()["id"]
        delete_resp = await client.delete(
            f"/api/v1/activities/{completed_id}/expenses/{expense_id}", headers=headers
        )
        assert delete_resp.status_code == 204

        after_delete_resp = await client.get("/api/v1/activities/summary", headers=headers)
        assert after_delete_resp.json()["total_expense"] == 0.0


@pytest.mark.asyncio
async def test_activity_history_accumulates(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """History records created/expense_added/status_changed in order, newest first."""
    uid = f"farmer_{uuid4()}"
    activity_type_id = reference_ids["activity_type_id"]
    expense_category_id = reference_ids["expense_category_id"]

    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        create_resp = await client.post(
            "/api/v1/activities",
            headers={"Authorization": "Bearer test"},
            json={"activity_type_id": activity_type_id, "status": "pending"},
        )
        activity_id = create_resp.json()["id"]

        expense_resp = await client.post(
            f"/api/v1/activities/{activity_id}/expenses",
            headers={"Authorization": "Bearer test"},
            json={"expense_category_id": expense_category_id, "amount": "500.00"},
        )
        assert expense_resp.status_code == 201

        update_resp = await client.patch(
            f"/api/v1/activities/{activity_id}",
            headers={"Authorization": "Bearer test"},
            json={"status": "completed"},
        )
        assert update_resp.status_code == 200

        history_resp = await client.get(
            f"/api/v1/activities/{activity_id}/history",
            headers={"Authorization": "Bearer test"},
        )
        assert history_resp.status_code == 200
        items = history_resp.json()["items"]
        assert len(items) == 3
        event_types = [item["event_type"] for item in items]
        assert event_types == ["status_changed", "expense_added", "created"]
        assert items[0]["detail"] == {"from": "pending", "to": "completed"}


@pytest.mark.asyncio
async def test_activity_summary_reflects_expenses(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    """Summary KPI totals reflect the activity's real, non-deleted expenses."""
    uid = f"farmer_{uuid4()}"
    activity_type_id = reference_ids["activity_type_id"]
    expense_category_id = reference_ids["expense_category_id"]

    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        create_resp = await client.post(
            "/api/v1/activities",
            headers={"Authorization": "Bearer test"},
            json={"activity_type_id": activity_type_id, "status": "pending"},
        )
        activity_id = create_resp.json()["id"]

        await client.post(
            f"/api/v1/activities/{activity_id}/expenses",
            headers={"Authorization": "Bearer test"},
            json={"expense_category_id": expense_category_id, "amount": "500.00"},
        )
        expense2_resp = await client.post(
            f"/api/v1/activities/{activity_id}/expenses",
            headers={"Authorization": "Bearer test"},
            json={"expense_category_id": expense_category_id, "amount": "250.00"},
        )
        expense2_id = expense2_resp.json()["id"]

        # Delete one expense — it should drop out of the summary total.
        delete_resp = await client.delete(
            f"/api/v1/activities/{activity_id}/expenses/{expense2_id}",
            headers={"Authorization": "Bearer test"},
        )
        assert delete_resp.status_code == 204

        summary_resp = await client.get(
            f"/api/v1/activities/{activity_id}/summary",
            headers={"Authorization": "Bearer test"},
        )
        assert summary_resp.status_code == 200
        summary = summary_resp.json()
        assert summary["total_expense"] == 500.0
        assert summary["expense_count"] == 1
        assert summary["status"] == "pending"
        assert summary["days_since_created"] == 0
