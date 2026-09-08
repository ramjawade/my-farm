from dataclasses import dataclass

import firebase_admin
from fastapi import Header, HTTPException, status
from firebase_admin import auth as firebase_auth
from firebase_admin.credentials import Base as FirebaseCredentialBase
from google.auth.credentials import Credentials as GoogleCredentials

from myfarm_api.core.config import get_settings


class _UnauthenticatedCredential(GoogleCredentials):
    """Never actually used to authenticate anything.

    `verify_id_token()`'s signature check hits Google's public JWKS
    endpoint directly and needs no credential of ours — but
    `firebase_admin.initialize_app()` still wants a credential object to
    construct its internal HTTP client. This satisfies that without a real
    service account, which this app never needs: verifying an ID token a
    client already has is all this service does with Firebase Auth.
    """

    def refresh(self, request: object) -> None:  # pragma: no cover - never called
        self.token = "unused"


class _UnauthenticatedFirebaseCredential(FirebaseCredentialBase):  # type: ignore[misc]
    # firebase_admin and google-auth ship no type stubs, so both base
    # classes resolve to Any under mypy — nothing to type more precisely
    # here without vendoring stubs for libraries that don't provide them.
    def get_credential(self) -> GoogleCredentials:
        return _UnauthenticatedCredential()  # type: ignore[no-untyped-call]


_firebase_app: firebase_admin.App | None = None


def get_firebase_app() -> firebase_admin.App:
    global _firebase_app
    if _firebase_app is None:
        settings = get_settings()
        _firebase_app = firebase_admin.initialize_app(
            _UnauthenticatedFirebaseCredential(),
            options={"projectId": settings.firebase_project_id},
            name="myfarm",
        )
    return _firebase_app


@dataclass(frozen=True)
class FirebaseIdentity:
    """The verified claims from a Firebase Auth ID token — nothing more.

    Deliberately not `CurrentFarmer`: resolving `uid` to a farmer row needs
    the `farmer` table, which is Stage 3's job (BACKEND_PLAN.md §5.1). This
    dependency answers exactly one question — is this token real, current,
    and issued for this project — and knows nothing about our schema.
    """

    uid: str
    phone_number: str | None


async def get_firebase_identity(
    authorization: str | None = Header(default=None),
) -> FirebaseIdentity:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Empty bearer token")

    try:
        decoded = firebase_auth.verify_id_token(token, app=get_firebase_app())
    except firebase_auth.ExpiredIdTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        ) from exc
    except firebase_auth.RevokedIdTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked"
        ) from exc
    except firebase_auth.InvalidIdTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc
    except Exception as exc:
        # Cert-fetch failures, malformed JSON, anything the SDK didn't wrap
        # in its own exception type — still an authentication failure from
        # the caller's point of view, never a 500.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token verification failed"
        ) from exc

    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing uid claim"
        )

    return FirebaseIdentity(uid=uid, phone_number=decoded.get("phone_number"))
