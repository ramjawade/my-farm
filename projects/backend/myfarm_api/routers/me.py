"""Current farmer profile endpoint — JIT provisioning on first call."""

from fastapi import APIRouter, Depends

from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.farmer import FarmerRead

router = APIRouter(tags=["farmer"])


@router.get("/api/v1/me", response_model=FarmerRead)
async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> FarmerRead:
    """Get the current authenticated farmer, provisioning on first call.

    JIT-creates a farmer row on first successful token verification, then
    returns it. Subsequent calls fetch the existing row.

    Requires a valid, current Firebase ID token with the correct audience.
    """
    farmer = await FarmerRepository.get_or_create(identity.uid)
    return FarmerRead.model_validate(farmer)
