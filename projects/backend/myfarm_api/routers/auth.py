from fastapi import APIRouter, Depends, HTTPException, status

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
    RegisterRequest,
    SessionRequest,
    SessionResponse,
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

    The status code tells the login screen what to do next, so it never has
    to pre-check whether an account exists (issue #50):

    - **404** — no account for this phone → the client offers to register.
    - **401** — account exists, wrong PIN → the client says "incorrect PIN".
    - **200** — `{ token, farmer }`.
    """
    farmer = await FarmerRepository.get_by_phone(body.phone)
    if farmer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account for that phone number",
        )
    if not verify_pin(body.pin, farmer.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect PIN",
        )

    return SessionResponse(
        token=issue_session_jwt(farmer.auth_uid),
        farmer=FarmerRead.model_validate(farmer),
    )
