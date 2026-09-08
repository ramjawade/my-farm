from fastapi import APIRouter, Depends

from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.get("/whoami")
async def whoami(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> dict[str, str | None]:
    """Proves the Firebase token dependency end to end: reject anything
    that isn't a live, current, correctly-audienced ID token; otherwise
    return exactly what was verified.

    Stage 3's `GET /api/v1/me` builds on this — it adds the farmer lookup
    (or just-in-time creation) that needs the `farmer` table, which doesn't
    exist yet. This route stays as the auth-only building block.
    """
    return {"uid": identity.uid, "phone_number": identity.phone_number}
