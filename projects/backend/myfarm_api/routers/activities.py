"""CRUD endpoints for activities — farmer-owned entities."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from myfarm_api.core.db import get_session_factory
from myfarm_api.core.dberrors import is_unique_violation
from myfarm_api.core.pagination import (
    DEFAULT_PAGE_LIMIT,
    CursorPosition,
    InvalidCursorError,
    decode_cursor,
    encode_cursor,
)
from myfarm_api.core.r2 import get_r2_service
from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.core.tenancy import ensure_owned
from myfarm_api.models import (
    Activity,
    ActivityAttachment,
    ActivityExpense,
    ActivityHistory,
    Farmer,
)
from myfarm_api.repositories.crud import ConflictError
from myfarm_api.repositories.entities import activity_repo, crop_repo, land_repo
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.activity import (
    ActivityCreate,
    ActivityDetailSummaryRead,
    ActivityRead,
    ActivitySummaryRead,
    ActivityUpdate,
)
from myfarm_api.schemas.activity_attachment import (
    ActivityAttachmentCreate,
    ActivityAttachmentRead,
    ActivityAttachmentUploadRequest,
    ActivityAttachmentUploadResponse,
)
from myfarm_api.schemas.activity_expense import (
    ActivityExpenseCreate,
    ActivityExpenseRead,
    ActivityExpenseUpdate,
)
from myfarm_api.schemas.activity_history import ActivityHistoryRead
from myfarm_api.schemas.common import DbId

router = APIRouter(prefix="/api/v1/activities", tags=["activities"])


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> Farmer:
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


async def _get_owned_activity(current_farmer: Farmer, activity_id: int) -> Activity:
    """Verify the activity exists and belongs to this farmer, or 404.

    Nested resources (expenses, attachments) have no `farmer_id` of their
    own — tenancy flows through this check on the parent activity.
    """
    activity = await activity_repo.get(current_farmer.id, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity


async def _record_history(
    activity_id: DbId,
    event_type: str,
    detail: dict[str, Any] | None = None,
    session: AsyncSession | None = None,
) -> None:
    """Append an audit-trail entry for an activity.

    Called with an already-open `session` from the expense handlers below so
    the history row commits atomically with the expense change; activity-level
    handlers (create/update/delete) pass no session since `activity_repo`
    manages its own — the history row there is a best-effort follow-up write,
    same looseness as the attachment R2-delete path elsewhere in this file.
    """
    entry = ActivityHistory(activity_id=activity_id, event_type=event_type, detail=detail)
    if session is not None:
        session.add(entry)
        return

    session_factory = get_session_factory()
    async with session_factory() as own_session:
        own_session.add(entry)
        await own_session.commit()


async def _ensure_owned_references(current_farmer: Farmer, payload: dict[str, Any]) -> None:
    """Verify every farmer-owned id in an activity payload belongs to the caller.

    Only keys actually present are checked, so a PATCH that does not mention
    `land_id` leaves the existing reference alone (#246).
    """
    if "land_id" in payload:
        await ensure_owned(land_repo, current_farmer.id, payload["land_id"], "Land")
    if "crop_id" in payload:
        await ensure_owned(crop_repo, current_farmer.id, payload["crop_id"], "Crop")
    if "parent_activity_id" in payload:
        await ensure_owned(
            activity_repo, current_farmer.id, payload["parent_activity_id"], "Activity"
        )


def _cost_expression() -> Any:
    """Sum of an activity's non-deleted expenses (0 when none), as a SQL expression."""
    total = (
        select(func.sum(ActivityExpense.amount))
        .where(ActivityExpense.activity_id == Activity.id, ActivityExpense.deleted_at.is_(None))
        .correlate(Activity)
        .scalar_subquery()
    )
    return func.coalesce(total, 0)


def _decode_or_422(raw: str, sort: str) -> CursorPosition:
    try:
        return decode_cursor(raw, sort)
    except InvalidCursorError:
        raise HTTPException(status_code=422, detail="Invalid cursor") from None


def _activity_page_clause(sort: str, position: CursorPosition, cost: Any) -> Any:
    """Predicate selecting the rows that come after `position` in the `sort` order."""
    row_id = position.id
    if sort in ("date_desc", "date_asc"):
        descending = sort == "date_desc"
        behind_id = Activity.id < row_id if descending else Activity.id > row_id
        if position.key is None:  # already in the undated tail
            return and_(Activity.date.is_(None), behind_id)
        ahead = Activity.date < position.key if descending else Activity.date > position.key
        return or_(ahead, and_(Activity.date == position.key, behind_id), Activity.date.is_(None))
    if sort == "cost_desc":
        last_cost = Decimal(position.key or "0")
        return or_(cost < last_cost, and_(cost == last_cost, Activity.id < row_id))
    last_updated = datetime.fromisoformat(position.key or "")
    return or_(
        Activity.updated_at < last_updated,
        and_(Activity.updated_at == last_updated, Activity.id < row_id),
    )


@router.get("", response_model=dict)
async def list_activities(
    status: list[str] | None = Query(None),
    crop_id: DbId | None = Query(None),
    season: str | None = Query(None),
    land_id: DbId | None = Query(None),
    activity_type_id: DbId | None = Query(None),
    sort: str | None = Query(None, pattern="^(date_asc|date_desc|cost_desc)$"),
    limit: int | None = Query(None, ge=1, le=100),
    cursor: str | None = Query(None),
    current_farmer: Farmer = Depends(get_current_farmer),
) -> dict[str, Any]:
    """List activities for the current farmer, one cursor-paginated page at a time.

    Returns `{ items, cursor, has_more }`; follow `cursor` until `has_more` is false to
    traverse every match exactly once. Sorts: default (most recently updated first),
    `date_asc`, `date_desc` (undated last) and `cost_desc`; ties break on id. Filters
    combine with AND and apply before paging.
    """
    sort_name = sort or "updated"
    cost = _cost_expression()

    conditions = [Activity.farmer_id == current_farmer.id, Activity.deleted_at.is_(None)]
    if status:
        conditions.append(Activity.status.in_(status))
    if crop_id is not None:
        conditions.append(Activity.crop_id == crop_id)
    if season is not None:
        conditions.append(Activity.season == season)
    if land_id is not None:
        conditions.append(Activity.land_id == land_id)
    if activity_type_id is not None:
        conditions.append(Activity.activity_type_id == activity_type_id)
    if cursor:
        conditions.append(_activity_page_clause(sort_name, _decode_or_422(cursor, sort_name), cost))

    stmt = select(Activity, cost.label("cost")).where(and_(*conditions))
    if sort == "date_asc":
        stmt = stmt.order_by(Activity.date.asc().nulls_last(), Activity.id.asc())
    elif sort == "date_desc":
        stmt = stmt.order_by(Activity.date.desc().nulls_last(), Activity.id.desc())
    elif sort == "cost_desc":
        stmt = stmt.order_by(cost.desc(), Activity.id.desc())
    else:
        stmt = stmt.order_by(Activity.updated_at.desc(), Activity.id.desc())

    page_size = limit or DEFAULT_PAGE_LIMIT
    if page_size:
        stmt = stmt.limit(page_size + 1)

    session_factory = get_session_factory()
    async with session_factory() as session:
        rows = list((await session.execute(stmt)).all())

    has_more = bool(page_size) and len(rows) > (page_size or 0)
    if has_more:
        rows = rows[:page_size]

    next_cursor = None
    if has_more:
        last, last_cost = rows[-1]
        keys = {
            "date_asc": last.date,
            "date_desc": last.date,
            "cost_desc": format(Decimal(last_cost), "f"),
        }
        key = keys.get(sort_name, last.updated_at.isoformat())
        next_cursor = encode_cursor(sort_name, key, last.id)

    return {
        "items": [ActivityRead.model_validate(activity) for activity, _ in rows],
        "cursor": next_cursor,
        "has_more": has_more,
    }


@router.get("/summary", response_model=ActivitySummaryRead)
async def get_activities_summary(
    crop_id: int | None = Query(None),
    current_farmer: Farmer = Depends(get_current_farmer),
) -> ActivitySummaryRead:
    """KPI counts + total expense for the current farmer, optionally scoped to a crop.

    Computed server-side (aggregate queries) rather than shipping the full
    activity list just to count/sum it client-side.
    """
    conditions = [
        Activity.farmer_id == current_farmer.id,
        Activity.deleted_at.is_(None),
    ]
    if crop_id is not None:
        conditions.append(Activity.crop_id == crop_id)

    pending_statuses = ["Scheduled", "Draft", "In Progress"]

    # One round trip: the three counts are FILTERed aggregates over the same scan,
    # and the expense total is a scalar subquery on the same conditions.
    total_expense = (
        select(func.coalesce(func.sum(ActivityExpense.amount), 0))
        .select_from(ActivityExpense)
        .join(Activity)
        .where(and_(*conditions, ActivityExpense.deleted_at.is_(None)))
        .scalar_subquery()
    )
    stmt = select(
        func.count(),
        func.count().filter(Activity.status == "Completed"),
        func.count().filter(Activity.status.in_(pending_statuses)),
        total_expense,
    ).where(and_(*conditions))

    session_factory = get_session_factory()
    async with session_factory() as session:
        total, completed, in_progress, total_expense_value = (await session.execute(stmt)).one()

    return ActivitySummaryRead(
        total=total,
        completed=completed,
        in_progress=in_progress,
        total_expense=float(total_expense_value or 0),
    )


@router.get("/expenses", response_model=dict)
async def list_all_expenses(
    limit: int | None = Query(None, ge=1, le=100),
    cursor: str | None = Query(None),
    current_farmer: Farmer = Depends(get_current_farmer),
) -> dict[str, Any]:
    """List the current farmer's expenses (joined through activities), one page at a time.

    Returns `{ items, cursor, has_more }`, most recently updated first with an id
    tie-break; soft-deleted expenses and expenses of deleted activities are excluded.
    """
    conditions = [
        Activity.farmer_id == current_farmer.id,
        Activity.deleted_at.is_(None),
        ActivityExpense.deleted_at.is_(None),
    ]
    if cursor:
        position = _decode_or_422(cursor, "expenses")
        last_updated = datetime.fromisoformat(position.key or "")
        conditions.append(
            or_(
                ActivityExpense.updated_at < last_updated,
                and_(ActivityExpense.updated_at == last_updated, ActivityExpense.id < position.id),
            )
        )

    stmt = (
        select(ActivityExpense)
        .join(Activity)
        .where(and_(*conditions))
        .order_by(ActivityExpense.updated_at.desc(), ActivityExpense.id.desc())
    )
    page_size = limit or DEFAULT_PAGE_LIMIT
    if page_size:
        stmt = stmt.limit(page_size + 1)

    session_factory = get_session_factory()
    async with session_factory() as session:
        expenses = list((await session.execute(stmt)).scalars().all())

    has_more = bool(page_size) and len(expenses) > (page_size or 0)
    if has_more:
        expenses = expenses[:page_size]
    next_cursor = (
        encode_cursor("expenses", expenses[-1].updated_at.isoformat(), expenses[-1].id)
        if has_more
        else None
    )
    return {
        "items": [ActivityExpenseRead.model_validate(e) for e in expenses],
        "cursor": next_cursor,
        "has_more": has_more,
    }


@router.get("/{activity_id}", response_model=ActivityRead)
async def get_activity(
    activity_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> ActivityRead:
    """Get a single activity by ID."""
    activity = await activity_repo.get(current_farmer.id, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return ActivityRead.model_validate(activity)


@router.post("", response_model=ActivityRead, status_code=201)
async def create_activity(
    data: ActivityCreate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> ActivityRead:
    """Create a new activity."""
    payload = data.model_dump()
    await _ensure_owned_references(current_farmer, payload)
    activity = Activity(**payload)
    try:
        activity = await activity_repo.create(current_farmer.id, activity)
    except ConflictError:
        raise HTTPException(
            status_code=409, detail="Activity with this ID already exists"
        ) from None
    await _record_history(activity.id, "created")
    return ActivityRead.model_validate(activity)


@router.patch("/{activity_id}", response_model=ActivityRead)
async def update_activity(
    activity_id: DbId,
    data: ActivityUpdate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> ActivityRead:
    """Update an activity."""
    existing = await activity_repo.get(current_farmer.id, activity_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Activity not found")
    old_status = existing.status

    updates = data.model_dump(exclude_unset=True)
    await _ensure_owned_references(current_farmer, updates)
    activity = await activity_repo.update(current_farmer.id, activity_id, updates)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    new_status = updates.get("status")
    if new_status is not None and new_status != old_status:
        await _record_history(
            activity_id, "status_changed", {"from": old_status, "to": new_status}
        )
    else:
        await _record_history(activity_id, "updated", updates)
    return ActivityRead.model_validate(activity)


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(
    activity_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> None:
    """Soft-delete an activity."""
    deleted = await activity_repo.soft_delete(current_farmer.id, activity_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Activity not found")
    await _record_history(activity_id, "deleted")


# Nested resource endpoints: activity expenses
#
# These have no farmer_id of their own (BACKEND_PLAN.md §6.1) — every
# handler below first resolves the parent activity through
# `_get_owned_activity`, which 404s for a wrong or cross-tenant activity_id,
# then scopes its query to that `activity_id` alone.


@router.get("/{activity_id}/expenses", response_model=dict)
async def list_activity_expenses(
    activity_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
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
            cursor_id = int(id_str)
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
    activity_id: DbId,
    data: ActivityExpenseCreate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> ActivityExpenseRead:
    """Create a new expense for an activity."""
    await _get_owned_activity(current_farmer, activity_id)

    payload = data.model_dump()
    expense = ActivityExpense(activity_id=activity_id, **payload)
    session_factory = get_session_factory()
    async with session_factory() as session:
        session.add(expense)
        await _record_history(
            activity_id,
            "expense_added",
            {
                "amount": float(payload["amount"]) if payload.get("amount") is not None else None,
                "expense_category_id": payload.get("expense_category_id"),
            },
            session=session,
        )
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            if is_unique_violation(e):
                raise HTTPException(
                    status_code=409, detail="Expense with this ID already exists"
                ) from e
            raise
        except Exception:
            await session.rollback()
            raise
        await session.refresh(expense)
    return ActivityExpenseRead.model_validate(expense)


@router.patch(
    "/{activity_id}/expenses/{expense_id}",
    response_model=ActivityExpenseRead,
)
async def update_activity_expense(
    activity_id: DbId,
    expense_id: DbId,
    data: ActivityExpenseUpdate,
    current_farmer: Farmer = Depends(get_current_farmer),
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

        changes = data.model_dump(exclude_unset=True)
        for key, value in changes.items():
            setattr(expense, key, value)

        await _record_history(activity_id, "expense_updated", changes, session=session)
        await session.commit()
        await session.refresh(expense)
    return ActivityExpenseRead.model_validate(expense)


@router.delete("/{activity_id}/expenses/{expense_id}", status_code=204)
async def delete_activity_expense(
    activity_id: DbId,
    expense_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
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
        await _record_history(
            activity_id,
            "expense_deleted",
            {"amount": float(expense.amount) if expense.amount is not None else None},
            session=session,
        )
        await session.commit()


@router.get("/{activity_id}/history", response_model=dict)
async def get_activity_history(
    activity_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    """Get the audit-trail/history entries for a single activity, newest first."""
    await _get_owned_activity(current_farmer, activity_id)

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = (
            select(ActivityHistory)
            .where(ActivityHistory.activity_id == activity_id)
            .order_by(ActivityHistory.created_at.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        entries = result.scalars().all()
    return {"items": [ActivityHistoryRead.model_validate(entry) for entry in entries]}


@router.get("/{activity_id}/summary", response_model=ActivityDetailSummaryRead)
async def get_activity_detail_summary(
    activity_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> ActivityDetailSummaryRead:
    """Get per-activity KPI summary: total expense, expense count, age, status."""
    activity = await _get_owned_activity(current_farmer, activity_id)

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(
            func.coalesce(func.sum(ActivityExpense.amount), 0),
            func.count(ActivityExpense.id),
        ).where(
            and_(
                ActivityExpense.activity_id == activity_id,
                ActivityExpense.deleted_at.is_(None),
            )
        )
        result = await session.execute(stmt)
        total_expense, expense_count = result.one()

    days_since_created = (datetime.now(UTC) - activity.created_at).days
    return ActivityDetailSummaryRead(
        total_expense=float(total_expense),
        expense_count=expense_count,
        days_since_created=days_since_created,
        status=activity.status,
    )


# Nested resource endpoints: activity attachments


@router.get("/{activity_id}/attachments", response_model=dict)
async def list_activity_attachments(
    activity_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
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
            cursor_id = int(id_str)
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
    "/{activity_id}/attachments/upload", response_model=ActivityAttachmentUploadResponse
)
async def get_attachment_upload_url(
    activity_id: DbId,
    request: ActivityAttachmentUploadRequest,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> ActivityAttachmentUploadResponse:
    """Get a presigned URL for uploading an attachment to R2.

    The client uploads the file directly to the URL, then calls POST /{activity_id}/attachments
    with the storage_key and file metadata.
    """
    await _get_owned_activity(current_farmer, activity_id)

    try:
        r2_service = get_r2_service()
        response = r2_service.generate_upload_url(
            activity_id, request.filename, request.content_type
        )
        return ActivityAttachmentUploadResponse(**response)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate upload URL: {str(e)}"
        ) from e


@router.post(
    "/{activity_id}/attachments", response_model=ActivityAttachmentRead, status_code=201
)
async def create_activity_attachment(
    activity_id: DbId,
    data: ActivityAttachmentCreate,
    current_farmer: Farmer = Depends(get_current_farmer),
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
    activity_id: DbId,
    attachment_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> None:
    """Soft-delete an attachment for an activity.

    Also deletes the file from R2 storage if configured.
    """
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

        # Try to delete from R2
        try:
            r2_service = get_r2_service()
            r2_service.delete_file(attachment.storage_key)
        except Exception as e:
            print(f"Warning: Failed to delete attachment from R2: {e}")

        attachment.deleted_at = datetime.now(UTC)
        await session.commit()
