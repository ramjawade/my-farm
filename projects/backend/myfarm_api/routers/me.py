"""Current farmer profile endpoint — JIT provisioning on first call."""

from fastapi import APIRouter, Depends, HTTPException, status

from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.farmer import FarmerRead, FarmerUpdate

router = APIRouter(tags=["farmer"])


@router.get("/api/v1/me", response_model=FarmerRead)
async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> FarmerRead:
    """Get the current authenticated farmer, provisioning on first call.

    JIT-creates a farmer row on first successful token verification, then
    returns it. Subsequent calls fetch the existing row.

    Accepts either a Firebase ID token or a backend-issued session JWT.
    """
    farmer = await FarmerRepository.get_or_create(identity.uid)
    return FarmerRead.model_validate(farmer)


@router.patch("/api/v1/me", response_model=FarmerRead)
async def update_current_farmer(
    body: FarmerUpdate,
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> FarmerRead:
    """Partial-update the current farmer's profile fields.

    Only the keys present in the request body are changed. The farmer row
    must already exist (call `GET /api/v1/me` once first — every
    authenticated entry point does).
    """
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        return FarmerRead.model_validate(await FarmerRepository.get_or_create(identity.uid))

    updated = await FarmerRepository.update_by_auth_uid(identity.uid, fields)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmer not found")
    return FarmerRead.model_validate(updated)
