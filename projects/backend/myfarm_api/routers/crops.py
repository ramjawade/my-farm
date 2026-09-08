"""CRUD endpoints for crops — farmer-owned entities."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import Crop, Farmer
from myfarm_api.repositories.entities import crop_repo
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.crop import CropCreate, CropRead, CropUpdate

router = APIRouter(prefix="/api/v1/crops", tags=["crops"])


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> Farmer:
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


@router.get("", response_model=dict)
async def list_crops(
    current_farmer: Farmer = Depends(get_current_farmer),
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """List crops for the current farmer, cursor-paginated."""
    page = await crop_repo.list(current_farmer.id, cursor=cursor, limit=limit)
    return {
        "items": [CropRead.model_validate(c) for c in page.items],
        "cursor": page.next_cursor,
        "has_more": page.has_more,
    }


@router.get("/{crop_id}", response_model=CropRead)
async def get_crop(
    crop_id: UUID,
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
    crop = Crop(**data.model_dump())
    crop = await crop_repo.create(current_farmer.id, crop)
    return CropRead.model_validate(crop)


@router.patch("/{crop_id}", response_model=CropRead)
async def update_crop(
    crop_id: UUID,
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
    crop_id: UUID,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> None:
    """Soft-delete a crop."""
    deleted = await crop_repo.soft_delete(current_farmer.id, crop_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Crop not found")
