"""CRUD endpoints for farms — farmer-owned entities."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import Farm, Farmer
from myfarm_api.repositories.crud import ConflictError
from myfarm_api.repositories.entities import farm_repo
from myfarm_api.repositories.farm_crops import (
    UnknownCropError,
    crop_ids_by_farm,
    replace_farm_crops,
)
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.common import DbId
from myfarm_api.schemas.farm import FarmCreate, FarmRead, FarmUpdate

router = APIRouter(prefix="/api/v1/farms", tags=["farms"])


async def _read_farms(farms: list[Farm]) -> list[FarmRead]:
    """Farm records with their crop catalog ids attached."""
    crops = await crop_ids_by_farm([f.id for f in farms])
    return [
        FarmRead.model_validate(f).model_copy(update={"crop_catalog_ids": crops[f.id]})
        for f in farms
    ]


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> Farmer:
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


@router.get("", response_model=dict)
async def list_farms(
    current_farmer: Farmer = Depends(get_current_farmer),
) -> dict[str, Any]:
    """List all farms for the current farmer."""
    farms = await farm_repo.list_all(current_farmer.id)
    return {
        "items": await _read_farms(farms),
    }


@router.get("/{farm_id}", response_model=FarmRead)
async def get_farm(
    farm_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> FarmRead:
    """Get a single farm by ID."""
    farm = await farm_repo.get(current_farmer.id, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return (await _read_farms([farm]))[0]


@router.post("", response_model=FarmRead, status_code=201)
async def create_farm(
    data: FarmCreate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> FarmRead:
    """Create a new farm."""
    farm = Farm(**data.model_dump())
    try:
        farm = await farm_repo.create(current_farmer.id, farm)
    except ConflictError:
        raise HTTPException(status_code=409, detail="Farm with this ID already exists") from None
    return (await _read_farms([farm]))[0]


@router.patch("/{farm_id}", response_model=FarmRead)
async def update_farm(
    farm_id: DbId,
    data: FarmUpdate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> FarmRead:
    """Update a farm."""
    updates = data.model_dump(exclude_unset=True)
    crop_ids = updates.pop("crop_catalog_ids", None)
    if crop_ids is not None and not await farm_repo.get(current_farmer.id, farm_id):
        raise HTTPException(status_code=404, detail="Farm not found")
    if crop_ids is not None:
        try:
            await replace_farm_crops(farm_id, crop_ids)
        except UnknownCropError:
            raise HTTPException(status_code=422, detail="Unknown crop_catalog_id") from None
    farm = await farm_repo.update(current_farmer.id, farm_id, updates)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return (await _read_farms([farm]))[0]


@router.delete("/{farm_id}", status_code=204)
async def delete_farm(
    farm_id: DbId,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> None:
    """Soft-delete a farm."""
    deleted = await farm_repo.soft_delete(current_farmer.id, farm_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Farm not found")
