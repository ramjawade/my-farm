"""CRUD endpoints for activities — farmer-owned entities."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import Activity
from myfarm_api.repositories.entities import activity_repo
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.activity import ActivityCreate, ActivityRead, ActivityUpdate

router = APIRouter(prefix="/api/v1/activities", tags=["activities"])


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
):
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


@router.get("", response_model=dict)
async def list_activities(
    current_farmer=Depends(get_current_farmer),
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """List activities for the current farmer, cursor-paginated."""
    page = await activity_repo.list(current_farmer.id, cursor=cursor, limit=limit)
    return {
        "items": [ActivityRead.model_validate(a) for a in page.items],
        "cursor": page.next_cursor,
        "has_more": page.has_more,
    }


@router.get("/{activity_id}", response_model=ActivityRead)
async def get_activity(
    activity_id: UUID,
    current_farmer=Depends(get_current_farmer),
) -> ActivityRead:
    """Get a single activity by ID."""
    activity = await activity_repo.get(current_farmer.id, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return ActivityRead.model_validate(activity)


@router.post("", response_model=ActivityRead, status_code=201)
async def create_activity(
    data: ActivityCreate,
    current_farmer=Depends(get_current_farmer),
) -> ActivityRead:
    """Create a new activity."""
    activity = Activity(**data.model_dump())
    activity = await activity_repo.create(current_farmer.id, activity)
    return ActivityRead.model_validate(activity)


@router.patch("/{activity_id}", response_model=ActivityRead)
async def update_activity(
    activity_id: UUID,
    data: ActivityUpdate,
    current_farmer=Depends(get_current_farmer),
) -> ActivityRead:
    """Update an activity."""
    activity = await activity_repo.update(
        current_farmer.id, activity_id, data.model_dump(exclude_unset=True)
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return ActivityRead.model_validate(activity)


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(
    activity_id: UUID,
    current_farmer=Depends(get_current_farmer),
) -> None:
    """Soft-delete an activity."""
    deleted = await activity_repo.soft_delete(current_farmer.id, activity_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Activity not found")
