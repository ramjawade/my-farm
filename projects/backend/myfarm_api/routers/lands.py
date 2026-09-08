"""CRUD endpoints for lands — farmer-owned entities."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import Land
from myfarm_api.repositories.entities import land_repo
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.land import LandCreate, LandRead, LandUpdate

router = APIRouter(prefix="/api/v1/lands", tags=["lands"])


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
):
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


@router.get("", response_model=dict)
async def list_lands(
    current_farmer=Depends(get_current_farmer),
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """List lands for the current farmer, cursor-paginated."""
    page = await land_repo.list(current_farmer.id, cursor=cursor, limit=limit)
    return {
        "items": [LandRead.model_validate(land) for land in page.items],
        "cursor": page.next_cursor,
        "has_more": page.has_more,
    }


@router.get("/{land_id}", response_model=LandRead)
async def get_land(
    land_id: UUID,
    current_farmer=Depends(get_current_farmer),
) -> LandRead:
    """Get a single land by ID."""
    land = await land_repo.get(current_farmer.id, land_id)
    if not land:
        raise HTTPException(status_code=404, detail="Land not found")
    return LandRead.model_validate(land)


@router.post("", response_model=LandRead, status_code=201)
async def create_land(
    data: LandCreate,
    current_farmer=Depends(get_current_farmer),
) -> LandRead:
    """Create a new land."""
    land = Land(**data.model_dump())
    land = await land_repo.create(current_farmer.id, land)
    return LandRead.model_validate(land)


@router.patch("/{land_id}", response_model=LandRead)
async def update_land(
    land_id: UUID,
    data: LandUpdate,
    current_farmer=Depends(get_current_farmer),
) -> LandRead:
    """Update a land."""
    land = await land_repo.update(
        current_farmer.id, land_id, data.model_dump(exclude_unset=True)
    )
    if not land:
        raise HTTPException(status_code=404, detail="Land not found")
    return LandRead.model_validate(land)


@router.delete("/{land_id}", status_code=204)
async def delete_land(
    land_id: UUID,
    current_farmer=Depends(get_current_farmer),
) -> None:
    """Soft-delete a land."""
    deleted = await land_repo.soft_delete(current_farmer.id, land_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Land not found")
