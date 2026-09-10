"""GET-only endpoints for reference data."""

from typing import Any

from fastapi import APIRouter
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
async def list_crop_catalog() -> dict[str, Any]:
    """List all available crops from the catalog."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(CropCatalog).order_by(CropCatalog.name)
        result = await session.execute(stmt)
        crops = result.scalars().all()
        return {
            "items": [CropCatalogRead.model_validate(c) for c in crops],
        }


@router.get("/expense-categories", response_model=dict)
async def list_expense_categories() -> dict[str, Any]:
    """List all available expense categories."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(ExpenseCategory).order_by(ExpenseCategory.name)
        result = await session.execute(stmt)
        categories = result.scalars().all()
        return {
            "items": [ExpenseCategoryRead.model_validate(e) for e in categories],
        }


@router.get("/activity-types", response_model=dict)
async def list_activity_types() -> dict[str, Any]:
    """List all available activity types."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(ActivityType).order_by(ActivityType.name)
        result = await session.execute(stmt)
        types = result.scalars().all()
        return {
            "items": [ActivityTypeRead.model_validate(a) for a in types],
        }
