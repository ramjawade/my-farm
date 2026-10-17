"""Mandi finder and the farmer's followed mandis."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, exists, func, select

from myfarm_api.core.config import get_settings
from myfarm_api.core.db import get_session_factory
from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import Crop, CropCatalog, Farm, Farmer, FarmerMandi, Mandi, PriceReading
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.mandi import MandiRead, MyMandisRead, MyMandisUpdate

router = APIRouter(prefix="/api/v1", tags=["mandis"])

DEFAULT_MANDI_COUNT = 3


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> Farmer:
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


async def farmer_commodities(farmer_id: int) -> list[str]:
    """Feed commodity names for the farmer's crops that have one, in a stable order."""
    async with get_session_factory()() as session:
        stmt = (
            select(CropCatalog.price_commodity)
            .join(Crop, Crop.crop_catalog_id == CropCatalog.id)
            .where(
                Crop.farmer_id == farmer_id,
                Crop.deleted_at.is_(None),
                CropCatalog.price_commodity.is_not(None),
            )
        )
        names = (await session.execute(stmt)).scalars().all()
    return sorted({n for n in names if n})


async def followed_mandis(farmer_id: int) -> tuple[list[Mandi], bool]:
    """The farmer's chosen mandis in order, or the district defaults (and True) if none chosen."""
    async with get_session_factory()() as session:
        stmt = (
            select(Mandi)
            .join(FarmerMandi, FarmerMandi.mandi_id == Mandi.id)
            .where(FarmerMandi.farmer_id == farmer_id)
            .order_by(FarmerMandi.position)
        )
        chosen = list((await session.execute(stmt)).scalars().all())
    if chosen:
        return chosen, False
    return await _default_mandis(farmer_id), True


async def _default_mandis(farmer_id: int) -> list[Mandi]:
    """Up to three mandis in the farm's district that have a price for one of the farmer's crops."""
    commodities = await farmer_commodities(farmer_id)
    if not commodities:
        return []
    async with get_session_factory()() as session:
        district_stmt = (
            select(Farm.district)
            .where(
                Farm.farmer_id == farmer_id,
                Farm.deleted_at.is_(None),
                Farm.district.is_not(None),
                Farm.district != "",
            )
            .order_by(Farm.id)
            .limit(1)
        )
        district = (await session.execute(district_stmt)).scalar_one_or_none()
        if not district:
            return []
        has_price = exists().where(
            PriceReading.mandi_id == Mandi.id, PriceReading.commodity.in_(commodities)
        )
        stmt = (
            select(Mandi)
            .where(func.lower(Mandi.district) == district.strip().lower(), has_price)
            .order_by(Mandi.name)
            .limit(DEFAULT_MANDI_COUNT)
        )
        return list((await session.execute(stmt)).scalars().all())


@router.get("/mandis/districts", response_model=dict)
async def list_districts(
    _farmer: Farmer = Depends(get_current_farmer),
) -> dict[str, Any]:
    """Districts that have at least one mandi, in name order."""
    async with get_session_factory()() as session:
        stmt = (
            select(Mandi.district)
            .where(Mandi.state == get_settings().mandi_state)
            .distinct()
            .order_by(Mandi.district)
        )
        return {"items": list((await session.execute(stmt)).scalars().all())}


@router.get("/mandis", response_model=dict)
async def find_mandis(
    district: str | None = Query(None, max_length=150),
    q: str | None = Query(None, max_length=100),
    commodity: str | None = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=100),
    _farmer: Farmer = Depends(get_current_farmer),
) -> dict[str, Any]:
    """Mandis narrowed by district, by partial name or district text, and by commodity."""
    stmt = select(Mandi).where(Mandi.state == get_settings().mandi_state)
    if district:
        stmt = stmt.where(func.lower(Mandi.district) == district.strip().lower())
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(func.lower(Mandi.name).like(like) | func.lower(Mandi.district).like(like))
    if commodity:
        stmt = stmt.where(
            exists().where(PriceReading.mandi_id == Mandi.id, PriceReading.commodity == commodity)
        )
    stmt = stmt.order_by(Mandi.name, Mandi.id).limit(limit)
    async with get_session_factory()() as session:
        rows = (await session.execute(stmt)).scalars().all()
    return {"items": [MandiRead.model_validate(m) for m in rows]}


@router.get("/me/mandis", response_model=MyMandisRead)
async def get_my_mandis(
    current_farmer: Farmer = Depends(get_current_farmer),
) -> MyMandisRead:
    """The mandis the farmer follows, or the suggested defaults for their district."""
    mandis, suggested = await followed_mandis(current_farmer.id)
    return MyMandisRead(items=[MandiRead.model_validate(m) for m in mandis], suggested=suggested)


@router.put("/me/mandis", response_model=MyMandisRead)
async def put_my_mandis(
    data: MyMandisUpdate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> MyMandisRead:
    """Replace the followed mandis (one to five, in the order given)."""
    ids = data.mandi_ids
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=422, detail="Mandis must not repeat")
    async with get_session_factory()() as session:
        found = (await session.execute(select(Mandi).where(Mandi.id.in_(ids)))).scalars().all()
        by_id = {m.id: m for m in found}
        if len(by_id) != len(ids):
            raise HTTPException(status_code=404, detail="Mandi not found")
        await session.execute(delete(FarmerMandi).where(FarmerMandi.farmer_id == current_farmer.id))
        session.add_all(
            FarmerMandi(farmer_id=current_farmer.id, mandi_id=mid, position=pos)
            for pos, mid in enumerate(ids)
        )
        await session.commit()
    return MyMandisRead(items=[MandiRead.model_validate(by_id[i]) for i in ids], suggested=False)
