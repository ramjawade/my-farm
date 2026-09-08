"""CRUD endpoints for activities — farmer-owned entities."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select

from myfarm_api.core.db import get_session_factory
from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import Activity, ActivityAttachment, ActivityExpense
from myfarm_api.repositories.entities import activity_repo
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.activity import ActivityCreate, ActivityRead, ActivityUpdate
from myfarm_api.schemas.activity_attachment import (
    ActivityAttachmentCreate,
    ActivityAttachmentRead,
)
from myfarm_api.schemas.activity_expense import (
    ActivityExpenseCreate,
    ActivityExpenseRead,
    ActivityExpenseUpdate,
)

router = APIRouter(prefix="/api/v1/activities", tags=["activities"])


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
):
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


async def _get_owned_activity(current_farmer, activity_id: UUID) -> Activity:
    """Verify the activity exists and belongs to this farmer, or 404.

    Nested resources (expenses, attachments) have no `farmer_id` of their
    own — tenancy flows through this check on the parent activity.
    """
    activity = await activity_repo.get(current_farmer.id, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity


@router.get("", response_model=dict)
async def list_activities(
    current_farmer=Depends(get_current_farmer),
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """List activities for the current farmer, cursor-paginated."""
    page = await activity_repo.list(current_farmer.id, cursor=cursor, limit=limit)
    return {
        "items": [ActivityRead.model_validate(a) for a in page.items],
        "cursor": page.next_cursor,
        "has_more": page.has_more,
    }


@router.get("/{activity_id}", response_model=ActivityRead)
async def get_activity(
    activity_id: UUID,
    current_farmer=Depends(get_current_farmer),
) -> ActivityRead:
    """Get a single activity by ID."""
    activity = await activity_repo.get(current_farmer.id, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return ActivityRead.model_validate(activity)


@router.post("", response_model=ActivityRead, status_code=201)
async def create_activity(
    data: ActivityCreate,
    current_farmer=Depends(get_current_farmer),
) -> ActivityRead:
    """Create a new activity."""
    activity = Activity(**data.model_dump())
    activity = await activity_repo.create(current_farmer.id, activity)
    return ActivityRead.model_validate(activity)


@router.patch("/{activity_id}", response_model=ActivityRead)
async def update_activity(
    activity_id: UUID,
    data: ActivityUpdate,
    current_farmer=Depends(get_current_farmer),
) -> ActivityRead:
    """Update an activity."""
    activity = await activity_repo.update(
        current_farmer.id, activity_id, data.model_dump(exclude_unset=True)
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return ActivityRead.model_validate(activity)


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(
    activity_id: UUID,
    current_farmer=Depends(get_current_farmer),
) -> None:
    """Soft-delete an activity."""
    deleted = await activity_repo.soft_delete(current_farmer.id, activity_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Activity not found")


# Nested resource endpoints: activity expenses
#
# These have no farmer_id of their own (BACKEND_PLAN.md §6.1) — every
# handler below first resolves the parent activity through
# `_get_owned_activity`, which 404s for a wrong or cross-tenant activity_id,
# then scopes its query to that `activity_id` alone.


@router.get("/{activity_id}/expenses", response_model=dict)
async def list_activity_expenses(
    activity_id: UUID,
    current_farmer=Depends(get_current_farmer),
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """List expenses for a specific activity, cursor-paginated."""
    await _get_owned_activity(current_farmer, activity_id)

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(ActivityExpense).where(
            and_(
                ActivityExpense.activity_id == activity_id,
                ActivityExpense.deleted_at.is_(None),
            )
        )
        if cursor:
            updated_at_str, id_str = cursor.rsplit(":", 1)
            cursor_updated_at = datetime.fromisoformat(updated_at_str)
            cursor_id = UUID(id_str)
            stmt = stmt.where(
                (ActivityExpense.updated_at < cursor_updated_at)
                | (
                    (ActivityExpense.updated_at == cursor_updated_at)
                    & (ActivityExpense.id < cursor_id)
                )
            )
        stmt = stmt.order_by(
            ActivityExpense.updated_at.desc(), ActivityExpense.id.desc()
        ).limit(limit + 1)
        result = await session.execute(stmt)
        rows = list(result.scalars().all())

    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]
    next_cursor = f"{rows[-1].updated_at.isoformat()}:{rows[-1].id}" if rows and has_more else None

    return {
        "items": [ActivityExpenseRead.model_validate(e) for e in rows],
        "cursor": next_cursor,
        "has_more": has_more,
    }


@router.post("/{activity_id}/expenses", response_model=ActivityExpenseRead, status_code=201)
async def create_activity_expense(
    activity_id: UUID,
    data: ActivityExpenseCreate,
    current_farmer=Depends(get_current_farmer),
) -> ActivityExpenseRead:
    """Create a new expense for an activity."""
    await _get_owned_activity(current_farmer, activity_id)

    expense = ActivityExpense(activity_id=activity_id, **data.model_dump())
    session_factory = get_session_factory()
    async with session_factory() as session:
        session.add(expense)
        await session.commit()
        await session.refresh(expense)
    return ActivityExpenseRead.model_validate(expense)


@router.patch(
    "/{activity_id}/expenses/{expense_id}",
    response_model=ActivityExpenseRead,
)
async def update_activity_expense(
    activity_id: UUID,
    expense_id: UUID,
    data: ActivityExpenseUpdate,
    current_farmer=Depends(get_current_farmer),
) -> ActivityExpenseRead:
    """Update an expense for an activity."""
    await _get_owned_activity(current_farmer, activity_id)

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(ActivityExpense).where(
            and_(
                ActivityExpense.id == expense_id,
                ActivityExpense.activity_id == activity_id,
                ActivityExpense.deleted_at.is_(None),
            )
        )
        result = await session.execute(stmt)
        expense = result.scalar_one_or_none()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")

        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(expense, key, value)

        await session.commit()
        await session.refresh(expense)
    return ActivityExpenseRead.model_validate(expense)


@router.delete("/{activity_id}/expenses/{expense_id}", status_code=204)
async def delete_activity_expense(
    activity_id: UUID,
    expense_id: UUID,
    current_farmer=Depends(get_current_farmer),
) -> None:
    """Soft-delete an expense for an activity."""
    await _get_owned_activity(current_farmer, activity_id)

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(ActivityExpense).where(
            and_(
                ActivityExpense.id == expense_id,
                ActivityExpense.activity_id == activity_id,
                ActivityExpense.deleted_at.is_(None),
            )
        )
        result = await session.execute(stmt)
        expense = result.scalar_one_or_none()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")

        expense.deleted_at = datetime.now(UTC)
        await session.commit()


# Nested resource endpoints: activity attachments


@router.get("/{activity_id}/attachments", response_model=dict)
async def list_activity_attachments(
    activity_id: UUID,
    current_farmer=Depends(get_current_farmer),
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """List attachments for a specific activity, cursor-paginated."""
    await _get_owned_activity(current_farmer, activity_id)

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(ActivityAttachment).where(
            and_(
                ActivityAttachment.activity_id == activity_id,
                ActivityAttachment.deleted_at.is_(None),
            )
        )
        if cursor:
            updated_at_str, id_str = cursor.rsplit(":", 1)
            cursor_updated_at = datetime.fromisoformat(updated_at_str)
            cursor_id = UUID(id_str)
            stmt = stmt.where(
                (ActivityAttachment.updated_at < cursor_updated_at)
                | (
                    (ActivityAttachment.updated_at == cursor_updated_at)
                    & (ActivityAttachment.id < cursor_id)
                )
            )
        stmt = stmt.order_by(
            ActivityAttachment.updated_at.desc(), ActivityAttachment.id.desc()
        ).limit(limit + 1)
        result = await session.execute(stmt)
        rows = list(result.scalars().all())

    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]
    next_cursor = f"{rows[-1].updated_at.isoformat()}:{rows[-1].id}" if rows and has_more else None

    return {
        "items": [ActivityAttachmentRead.model_validate(a) for a in rows],
        "cursor": next_cursor,
        "has_more": has_more,
    }


@router.post(
    "/{activity_id}/attachments", response_model=ActivityAttachmentRead, status_code=201
)
async def create_activity_attachment(
    activity_id: UUID,
    data: ActivityAttachmentCreate,
    current_farmer=Depends(get_current_farmer),
) -> ActivityAttachmentRead:
    """Create a new attachment for an activity."""
    await _get_owned_activity(current_farmer, activity_id)

    attachment = ActivityAttachment(activity_id=activity_id, **data.model_dump())
    session_factory = get_session_factory()
    async with session_factory() as session:
        session.add(attachment)
        await session.commit()
        await session.refresh(attachment)
    return ActivityAttachmentRead.model_validate(attachment)


@router.delete("/{activity_id}/attachments/{attachment_id}", status_code=204)
async def delete_activity_attachment(
    activity_id: UUID,
    attachment_id: UUID,
    current_farmer=Depends(get_current_farmer),
) -> None:
    """Soft-delete an attachment for an activity."""
    await _get_owned_activity(current_farmer, activity_id)

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(ActivityAttachment).where(
            and_(
                ActivityAttachment.id == attachment_id,
                ActivityAttachment.activity_id == activity_id,
                ActivityAttachment.deleted_at.is_(None),
            )
        )
        result = await session.execute(stmt)
        attachment = result.scalar_one_or_none()
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")

        attachment.deleted_at = datetime.now(UTC)
        await session.commit()
