"""Reference data endpoints: list and create catalog entries."""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from myfarm_api.core.db import get_session_factory
from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import ActivityType, CropCatalog, CropStage, ExpenseCategory, Season
from myfarm_api.schemas.reference import (
    ActivityTypeCreate,
    ActivityTypeRead,
    CropCatalogCreate,
    CropCatalogRead,
    CropStageRead,
    ExpenseCategoryRead,
    SeasonRead,
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


@router.post("/crops", response_model=CropCatalogRead)
async def create_or_get_crop(
    payload: CropCatalogCreate,
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> CropCatalog:
    """Create a new crop or return the existing one (case-insensitive)."""
    crop_name = payload.name.strip()

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(CropCatalog).where(func.lower(CropCatalog.name) == crop_name.lower())
        result = await session.execute(stmt)
        existing_crop = result.scalar_one_or_none()

        if existing_crop:
            return existing_crop

        new_crop = CropCatalog(name=crop_name)
        session.add(new_crop)
        await session.commit()
        await session.refresh(new_crop)
        return new_crop


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


@router.post("/activity-types", response_model=ActivityTypeRead)
async def create_or_get_activity_type(
    payload: ActivityTypeCreate,
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> ActivityType:
    """Create a new activity type or return the existing one (case-insensitive)."""
    type_name = payload.name.strip()

    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(ActivityType).where(func.lower(ActivityType.name) == type_name.lower())
        result = await session.execute(stmt)
        existing_type = result.scalar_one_or_none()

        if existing_type:
            return existing_type

        new_type = ActivityType(name=type_name)
        session.add(new_type)
        await session.commit()
        await session.refresh(new_type)
        return new_type


@router.get("/seasons", response_model=dict)
async def list_seasons() -> dict[str, Any]:
    """List all available seasons."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(Season).order_by(Season.name)
        result = await session.execute(stmt)
        seasons = result.scalars().all()
        return {
            "items": [SeasonRead.model_validate(s) for s in seasons],
        }


@router.get("/crop-stages", response_model=dict)
async def list_crop_stages() -> dict[str, Any]:
    """List all available crop stages."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(CropStage).order_by(CropStage.name)
        result = await session.execute(stmt)
        stages = result.scalars().all()
        return {
            "items": [CropStageRead.model_validate(c) for c in stages],
        }
