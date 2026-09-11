"""CRUD endpoints for lands — farmer-owned entities."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import Farmer, Land, LandPoint
from myfarm_api.repositories.crud import ConflictError
from myfarm_api.repositories.entities import land_repo
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.land import LandCreate, LandRead, LandUpdate

router = APIRouter(prefix="/api/v1/lands", tags=["lands"])


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> Farmer:
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


@router.get("", response_model=dict)
async def list_lands(
    current_farmer: Farmer = Depends(get_current_farmer),
) -> dict[str, Any]:
    """List all lands for the current farmer."""
    lands = await land_repo.list_all(current_farmer.id)
    return {
        "items": [LandRead.model_validate(land) for land in lands],
    }


@router.get("/{land_id}", response_model=LandRead)
async def get_land(
    land_id: int,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> LandRead:
    """Get a single land by ID."""
    land = await land_repo.get(current_farmer.id, land_id)
    if not land:
        raise HTTPException(status_code=404, detail="Land not found")
    return LandRead.model_validate(land)


@router.post("", response_model=LandRead, status_code=201)
async def create_land(
    data: LandCreate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> LandRead:
    """Create a new land."""
    payload = data.model_dump(exclude={"points"})
    land = Land(**payload)
    try:
        land = await land_repo.create(current_farmer.id, land)
    except ConflictError:
        raise HTTPException(status_code=409, detail="Land with this ID already exists") from None

    # Add points if provided
    if data.points:
        land.points = [
            LandPoint(land_id=land.id, seq=i, lat=p.lat, lng=p.lng)
            for i, p in enumerate(data.points)
        ]
        # Save points to the database
        from myfarm_api.core.db import get_session_factory
        session_factory = get_session_factory()
        async with session_factory() as session:
            session.add_all(land.points)
            await session.commit()
            # Refresh to get fresh data
            await session.refresh(land)

    return LandRead.model_validate(land)


@router.patch("/{land_id}", response_model=LandRead)
async def update_land(
    land_id: int,
    data: LandUpdate,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> LandRead:
    """Update a land."""
    # Separate points from other updates
    payload = data.model_dump(exclude_unset=True, exclude={"points"})
    land = await land_repo.update(current_farmer.id, land_id, payload)
    if not land:
        raise HTTPException(status_code=404, detail="Land not found")

    # Update points if provided
    if data.points is not None:
        from myfarm_api.core.db import get_session_factory
        session_factory = get_session_factory()
        async with session_factory() as session:
            # Delete existing points
            from sqlalchemy import delete
            stmt = delete(LandPoint).where(LandPoint.land_id == land_id)
            await session.execute(stmt)

            # Add new points
            new_points = [
                LandPoint(land_id=land_id, seq=i, lat=p.lat, lng=p.lng)
                for i, p in enumerate(data.points)
            ]
            session.add_all(new_points)
            await session.commit()

    # Refresh the land to get updated points
    land = await land_repo.get(current_farmer.id, land_id)
    return LandRead.model_validate(land)


@router.delete("/{land_id}", status_code=204)
async def delete_land(
    land_id: int,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> None:
    """Soft-delete a land."""
    deleted = await land_repo.soft_delete(current_farmer.id, land_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Land not found")
