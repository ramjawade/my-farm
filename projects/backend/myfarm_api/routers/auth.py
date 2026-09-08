from fastapi import APIRouter, Depends, HTTPException, Query, status

from myfarm_api.core.security import (
    FirebaseIdentity,
    get_firebase_identity,
    hash_pin,
    issue_session_jwt,
    verify_pin,
)
from myfarm_api.repositories.farmer import (
    FarmerRepository,
    PhoneAlreadyRegisteredError,
)
from myfarm_api.schemas.auth import (
    PhoneLookupResponse,
    RegisterRequest,
    SessionRequest,
    SessionResponse,
    normalize_phone,
)
from myfarm_api.schemas.farmer import FarmerRead

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.get("/whoami")
async def whoami(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> dict[str, str | None]:
    """Proves the auth dependency end to end: reject anything that isn't a
    live Firebase ID token or a valid backend session JWT; otherwise return
    exactly what was verified.
    """
    return {"uid": identity.uid, "phone_number": identity.phone_number}


@router.get("/lookup", response_model=PhoneLookupResponse)
async def lookup_phone(phone: str = Query(min_length=1, max_length=20)) -> PhoneLookupResponse:
    """Whether a farmer with this phone exists — lets the login screen pick
    the "enter PIN" vs "register" path. Deliberately says nothing about
    whether a PIN is set or anything else about the account.
    """
    normalized = normalize_phone(phone)
    if len(normalized) != 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="phone must be a 10-digit mobile number",
        )
    farmer = await FarmerRepository.get_by_phone(normalized)
    return PhoneLookupResponse(exists=farmer is not None)


@router.post("/register", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> SessionResponse:
    """Create a PIN account and hand back a session JWT."""
    try:
        farmer = await FarmerRepository.create_pin_farmer(
            phone=body.phone,
            full_name=body.full_name,
            pin_hash=hash_pin(body.pin),
            preferred_language=body.preferred_language,
        )
    except PhoneAlreadyRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That phone number is already registered",
        ) from exc

    return SessionResponse(
        token=issue_session_jwt(farmer.auth_uid),
        farmer=FarmerRead.model_validate(farmer),
    )


@router.post("/session", response_model=SessionResponse)
async def create_session(body: SessionRequest) -> SessionResponse:
    """Verify phone + PIN, issue a session JWT.

    One 401 for both "no such phone" and "wrong PIN" — the caller learns
    nothing it couldn't already get from `/auth/lookup`.
    """
    farmer = await FarmerRepository.get_by_phone(body.phone)
    if farmer is None or not verify_pin(body.pin, farmer.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or PIN",
        )

    return SessionResponse(
        token=issue_session_jwt(farmer.auth_uid),
        farmer=FarmerRead.model_validate(farmer),
    )
