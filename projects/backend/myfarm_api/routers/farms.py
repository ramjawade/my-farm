"""CRUD endpoints for farms — farmer-owned entities."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import Farm, Farmer
from myfarm_api.repositories.entities import farm_repo
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.farm import FarmCreate, FarmRead, FarmUpdate

router = APIRouter(prefix="/api/v1/farms", tags=["farms"])


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> Farmer:
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


@router.get("", response_model=dict)
async def list_farms(
    current_farmer: Farmer = Depends(get_current_farmer),
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """List farms for the current farmer, cursor-paginated."""
    page = await farm_repo.list(current_farmer.id, cursor=cursor, limit=limit)
    return {
        "items": [FarmRead.model_validate(f) for f in page.items],
        "cursor": page.next_cursor,
        "has_more": page.has_more,
    }


@router.get("/{farm_id}", response_model=FarmRead)
async def get_farm(
    farm_id: UUID,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> FarmRead:
    """Get a single farm by ID."""
    farm = await farm_repo.get(current_farmer.id, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return FarmRead.model_validate(farm)


@router.post("", response_model=FarmRead, status_code=201)
async def create_farm(
    data: FarmCreate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> FarmRead:
    """Create a new farm."""
    farm = Farm(**data.model_dump())
    farm = await farm_repo.create(current_farmer.id, farm)
    return FarmRead.model_validate(farm)


@router.patch("/{farm_id}", response_model=FarmRead)
async def update_farm(
    farm_id: UUID,
    data: FarmUpdate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> FarmRead:
    """Update a farm."""
    farm = await farm_repo.update(
        current_farmer.id, farm_id, data.model_dump(exclude_unset=True)
    )
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return FarmRead.model_validate(farm)


@router.delete("/{farm_id}", status_code=204)
async def delete_farm(
    farm_id: UUID,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> None:
    """Soft-delete a farm."""
    deleted = await farm_repo.soft_delete(current_farmer.id, farm_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Farm not found")
