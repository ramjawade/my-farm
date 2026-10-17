"""CRUD endpoints for crops — farmer-owned entities."""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select

from myfarm_api.core.db import get_session_factory
from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.core.tenancy import ensure_owned
from myfarm_api.models import Crop, CropSale, Farmer
from myfarm_api.repositories.crud import ConflictError
from myfarm_api.repositories.entities import crop_repo, land_repo
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.common import DbId
from myfarm_api.schemas.crop import CropCreate, CropRead, CropUpdate
from myfarm_api.schemas.crop_sale import CropSaleCreate, CropSaleRead, CropSaleUpdate

router = APIRouter(prefix="/api/v1/crops", tags=["crops"])


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> Farmer:
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


@router.get("", response_model=dict)
async def list_crops(
    current_farmer: Farmer = Depends(get_current_farmer),
) -> dict[str, Any]:
    """List all crops for the current farmer."""
    crops = await crop_repo.list_all(current_farmer.id)
    return {
        "items": [CropRead.model_validate(c) for c in crops],
    }


@router.get("/{crop_id}", response_model=CropRead)
async def get_crop(
    crop_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> CropRead:
    """Get a single crop by ID."""
    crop = await crop_repo.get(current_farmer.id, crop_id)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    return CropRead.model_validate(crop)


@router.post("", response_model=CropRead, status_code=201)
async def create_crop(
    data: CropCreate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> CropRead:
    """Create a new crop."""
    payload = data.model_dump()
    await ensure_owned(land_repo, current_farmer.id, payload.get("land_id"), "Land")
    crop = Crop(**payload)
    try:
        crop = await crop_repo.create(current_farmer.id, crop)
    except ConflictError:
        raise HTTPException(status_code=409, detail="Crop with this ID already exists") from None
    return CropRead.model_validate(crop)


@router.patch("/{crop_id}", response_model=CropRead)
async def update_crop(
    crop_id: DbId,
    data: CropUpdate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> CropRead:
    """Update a crop."""
    crop = await crop_repo.update(
        current_farmer.id, crop_id, data.model_dump(exclude_unset=True)
    )
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    return CropRead.model_validate(crop)


@router.delete("/{crop_id}", status_code=204)
async def delete_crop(
    crop_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> None:
    """Soft-delete a crop."""
    deleted = await crop_repo.soft_delete(current_farmer.id, crop_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Crop not found")


async def _ensure_crop_owned(current_farmer: Farmer, crop_id: int) -> None:
    """404 unless the crop is the caller's. Sales carry no `farmer_id`; tenancy flows through it."""
    await ensure_owned(crop_repo, current_farmer.id, crop_id, "Crop")


def _live_sale(crop_id: int, sale_id: int) -> Any:
    return select(CropSale).where(
        and_(
            CropSale.id == sale_id,
            CropSale.crop_id == crop_id,
            CropSale.deleted_at.is_(None),
        )
    )


@router.get("/{crop_id}/sales", response_model=dict)
async def list_crop_sales(
    crop_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> dict[str, Any]:
    """List a crop's sales, newest first."""
    await _ensure_crop_owned(current_farmer, crop_id)
    async with get_session_factory()() as session:
        stmt = (
            select(CropSale)
            .where(and_(CropSale.crop_id == crop_id, CropSale.deleted_at.is_(None)))
            .order_by(CropSale.sold_on.desc(), CropSale.id.desc())
        )
        rows = (await session.execute(stmt)).scalars().all()
    return {"items": [CropSaleRead.model_validate(r) for r in rows]}


@router.post("/{crop_id}/sales", response_model=CropSaleRead, status_code=201)
async def create_crop_sale(
    crop_id: DbId,
    data: CropSaleCreate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> CropSaleRead:
    """Record a sale of a crop."""
    await _ensure_crop_owned(current_farmer, crop_id)
    sale = CropSale(crop_id=crop_id, **data.model_dump())
    async with get_session_factory()() as session:
        session.add(sale)
        await session.commit()
        await session.refresh(sale)
    return CropSaleRead.model_validate(sale)


@router.patch("/{crop_id}/sales/{sale_id}", response_model=CropSaleRead)
async def update_crop_sale(
    crop_id: DbId,
    sale_id: DbId,
    data: CropSaleUpdate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> CropSaleRead:
    """Update a sale."""
    await _ensure_crop_owned(current_farmer, crop_id)
    async with get_session_factory()() as session:
        sale = (await session.execute(_live_sale(crop_id, sale_id))).scalar_one_or_none()
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(sale, key, value)
        await session.commit()
        await session.refresh(sale)
    return CropSaleRead.model_validate(sale)


@router.delete("/{crop_id}/sales/{sale_id}", status_code=204)
async def delete_crop_sale(
    crop_id: DbId,
    sale_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> None:
    """Soft-delete a sale."""
    await _ensure_crop_owned(current_farmer, crop_id)
    async with get_session_factory()() as session:
        sale = (await session.execute(_live_sale(crop_id, sale_id))).scalar_one_or_none()
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")
        sale.deleted_at = datetime.now(UTC)
        await session.commit()
