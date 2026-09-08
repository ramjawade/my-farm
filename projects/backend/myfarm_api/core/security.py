import hashlib
import hmac
import os
import time
from dataclasses import dataclass

import firebase_admin
import jwt
from fastapi import Header, HTTPException, status
from firebase_admin import auth as firebase_auth
from firebase_admin.credentials import Base as FirebaseCredentialBase
from google.auth.credentials import Credentials as GoogleCredentials

from myfarm_api.core.config import get_settings
from myfarm_api.core.ids import uuid7

# --- PIN hashing (issue #45) -------------------------------------------------
#
# Raw PIN crosses the wire over TLS; the database only ever stores this
# derived form. PBKDF2-SHA256 from the stdlib — no new dependency, and a PIN
# is a 4-6 digit secret so a deliberately slow KDF is the whole defence if
# the column ever leaks.

_PBKDF2_ITERATIONS = 600_000
_PBKDF2_SALT_BYTES = 16


def hash_pin(pin: str) -> str:
    """`pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>`."""
    salt = os.urandom(_PBKDF2_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_pin(pin: str, stored: str | None) -> bool:
    """Constant-time check of `pin` against a `hash_pin()` string."""
    if not stored:
        return False
    try:
        scheme, iterations_s, salt_hex, hash_hex = stored.split("$")
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt_hex), int(iterations_s))
    return hmac.compare_digest(digest.hex(), hash_hex)


# --- Session JWT (issue #45) ------------------------------------------------

_JWT_ALGORITHM = "HS256"


def _session_secret() -> str:
    secret = get_settings().session_jwt_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session auth is not configured",
        )
    return secret


def issue_session_jwt(auth_uid: str) -> str:
    """HS256 token, `sub` = the farmer's `auth_uid`, expiring in ~24h."""
    now = int(time.time())
    payload = {
        "sub": auth_uid,
        "iat": now,
        "exp": now + get_settings().session_jwt_ttl_seconds,
        "iss": "myfarm-api",
    }
    return jwt.encode(payload, _session_secret(), algorithm=_JWT_ALGORITHM)


def _verify_session_jwt(token: str) -> "FirebaseIdentity | None":
    """Return the identity a valid session JWT carries, else None.

    None (not an exception) on every failure mode so the caller can fall
    through to its own "unauthenticated" response — this is only ever tried
    after Firebase verification has already declined the same token.
    """
    secret = get_settings().session_jwt_secret
    if not secret:
        return None
    try:
        decoded = jwt.decode(
            token, secret, algorithms=[_JWT_ALGORITHM], issuer="myfarm-api"
        )
    except jwt.PyJWTError:
        return None
    sub = decoded.get("sub")
    if not sub:
        return None
    return FirebaseIdentity(uid=sub, phone_number=None)


def new_pin_auth_uid() -> str:
    """`auth_uid` for a PIN account — namespaced so it never collides with a
    Firebase uid, and opaque so it leaks nothing about the farmer."""
    return f"pin:{uuid7()}"


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
    """Resolve the bearer token to an identity.

    Accepts **either** a Firebase ID token or a backend-issued session JWT
    (issue #45): Firebase verification is tried first, and a token it can't
    place as a live, current, correctly-audienced ID token falls through to
    the session-JWT check before the request is rejected. A genuinely
    expired or revoked Firebase token is final — it never falls through.
    """
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
        session_identity = _verify_session_jwt(token)
        if session_identity is not None:
            return session_identity
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc
    except Exception as exc:
        # Cert-fetch failures, malformed JSON, anything the SDK didn't wrap
        # in its own exception type — still an authentication failure from
        # the caller's point of view, never a 500.
        session_identity = _verify_session_jwt(token)
        if session_identity is not None:
            return session_identity
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token verification failed"
        ) from exc

    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing uid claim"
        )

    return FirebaseIdentity(uid=uid, phone_number=decoded.get("phone_number"))
