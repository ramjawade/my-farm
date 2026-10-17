"""Reference data endpoints: list and create catalog entries."""

from typing import Any

from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from myfarm_api.core.db import get_session_factory
from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import ActivityType, CropCatalog, CropStage, ExpenseCategory, Season
from myfarm_api.repositories.farmer import FarmerRepository
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

# Seeded lists with no create endpoint never change between deploys, so browsers
# may reuse them instead of refetching on every page load (#316). The crop and
# activity-type lists can grow via POST, so they are deliberately not cached.
_STATIC_CACHE = "public, max-age=3600"


async def optional_identity(
    authorization: str | None = Header(default=None),
) -> FirebaseIdentity | None:
    """The signed-in identity, or None when no Authorization header is sent."""
    if not authorization:
        return None
    return await get_firebase_identity(authorization)


def _crop_read(crop: CropCatalog) -> CropCatalogRead:
    return CropCatalogRead(
        id=crop.id,
        name=crop.name,
        common_names=crop.common_names,
        category=crop.category,
        custom=crop.farmer_id is not None,
    )


@router.get("/crops", response_model=dict)
async def list_crop_catalog(
    identity: FirebaseIdentity | None = Depends(optional_identity),
) -> dict[str, Any]:
    """The predefined crops, plus the signed-in farmer's own custom crops."""
    farmer_id = (await FarmerRepository.get_or_create(identity.uid)).id if identity else None
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(CropCatalog).order_by(CropCatalog.name)
        if farmer_id is None:
            stmt = stmt.where(CropCatalog.farmer_id.is_(None))
        else:
            stmt = stmt.where(
                or_(CropCatalog.farmer_id.is_(None), CropCatalog.farmer_id == farmer_id)
            )
        crops = (await session.execute(stmt)).scalars().all()
        return {"items": [_crop_read(c) for c in crops]}


@router.post("/crops", response_model=CropCatalogRead)
async def create_or_get_crop(
    payload: CropCatalogCreate,
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> CropCatalogRead:
    """Use a predefined crop, the farmer's own crop, or add a new private custom crop.

    A name matching a predefined crop (any case) returns that crop; a name matching
    the farmer's own custom crop returns it; anything else creates a custom crop
    owned by the caller, so one farmer's typos never reach another farmer's list.
    """
    crop_name = payload.name
    farmer = await FarmerRepository.get_or_create(identity.uid)

    async def find(session: AsyncSession) -> CropCatalog | None:
        stmt = (
            select(CropCatalog)
            .where(
                func.lower(CropCatalog.name) == crop_name.lower(),
                or_(CropCatalog.farmer_id.is_(None), CropCatalog.farmer_id == farmer.id),
            )
            .order_by(CropCatalog.farmer_id.is_(None).desc(), CropCatalog.id)
        )
        found: CropCatalog | None = (await session.execute(stmt)).scalars().first()
        return found

    session_factory = get_session_factory()
    async with session_factory() as session:
        existing = await find(session)
        if existing is None:
            new_crop = CropCatalog(name=crop_name, category="other", farmer_id=farmer.id)
            session.add(new_crop)
            try:
                await session.commit()
            except IntegrityError:
                # A concurrent request added the same name first; use that one.
                await session.rollback()
                existing = await find(session)
                if existing is None:
                    raise
                return _crop_read(existing)
            await session.refresh(new_crop)
            return _crop_read(new_crop)
        return _crop_read(existing)


@router.get("/expense-categories", response_model=dict)
async def list_expense_categories(response: Response) -> dict[str, Any]:
    """List all available expense categories."""
    response.headers["Cache-Control"] = _STATIC_CACHE
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
async def list_seasons(response: Response) -> dict[str, Any]:
    """List all available seasons."""
    response.headers["Cache-Control"] = _STATIC_CACHE
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(Season).order_by(Season.name)
        result = await session.execute(stmt)
        seasons = result.scalars().all()
        return {
            "items": [SeasonRead.model_validate(s) for s in seasons],
        }


@router.get("/crop-stages", response_model=dict)
async def list_crop_stages(response: Response) -> dict[str, Any]:
    """List all available crop stages."""
    response.headers["Cache-Control"] = _STATIC_CACHE
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(CropStage).order_by(CropStage.name)
        result = await session.execute(stmt)
        stages = result.scalars().all()
        return {
            "items": [CropStageRead.model_validate(c) for c in stages],
        }
