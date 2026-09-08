"""GET-only endpoints for reference data."""

from typing import Any

from fastapi import APIRouter, Query
from sqlalchemy import select

from myfarm_api.core.db import get_session_factory
from myfarm_api.models import ActivityType, CropCatalog, ExpenseCategory
from myfarm_api.schemas.reference import (
    ActivityTypeRead,
    CropCatalogRead,
    ExpenseCategoryRead,
)

router = APIRouter(prefix="/api/v1/reference", tags=["reference"])


@router.get("/crops", response_model=dict)
async def list_crop_catalog(
    cursor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """List available crops from the catalog, cursor-paginated."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(CropCatalog).order_by(CropCatalog.name).limit(limit + 1)

        # Parse cursor if provided
        if cursor:
            try:
                last_name = cursor
                stmt = stmt.where(CropCatalog.name > last_name)
            except ValueError:
                pass

        result = await session.execute(stmt)
        rows = result.scalars().all()

        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]

        next_cursor = None
        if rows and has_more:
            next_cursor = rows[-1].name

        return {
            "items": [CropCatalogRead.model_validate(c) for c in rows],
            "cursor": next_cursor,
            "has_more": has_more,
        }


@router.get("/expense-categories", response_model=dict)
async def list_expense_categories(
    cursor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """List available expense categories, cursor-paginated."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(ExpenseCategory).order_by(ExpenseCategory.name).limit(limit + 1)

        # Parse cursor if provided
        if cursor:
            try:
                last_name = cursor
                stmt = stmt.where(ExpenseCategory.name > last_name)
            except ValueError:
                pass

        result = await session.execute(stmt)
        rows = result.scalars().all()

        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]

        next_cursor = None
        if rows and has_more:
            next_cursor = rows[-1].name

        return {
            "items": [ExpenseCategoryRead.model_validate(c) for c in rows],
            "cursor": next_cursor,
            "has_more": has_more,
        }


@router.get("/activity-types", response_model=dict)
async def list_activity_types(
    cursor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """List available activity types, cursor-paginated."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(ActivityType).order_by(ActivityType.name).limit(limit + 1)

        # Parse cursor if provided
        if cursor:
            try:
                last_name = cursor
                stmt = stmt.where(ActivityType.name > last_name)
            except ValueError:
                pass

        result = await session.execute(stmt)
        rows = result.scalars().all()

        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]

        next_cursor = None
        if rows and has_more:
            next_cursor = rows[-1].name

        return {
            "items": [ActivityTypeRead.model_validate(a) for a in rows],
            "cursor": next_cursor,
            "has_more": has_more,
        }
