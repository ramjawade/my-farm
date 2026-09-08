"""Proves the Firebase token dependency rejects what it should — the
Stage 2 gate. Malformed/forged tokens are exercised against the real
`firebase_admin` verification path (no mocking): they fail on structural
grounds (segment count, algorithm, audience) that don't require a live
Firebase project or network access to a real signing key. Expired/revoked
are exercised by mocking the SDK's own exception types, since producing a
token that is genuinely, validly *expired* requires a real project's
signing key — that's Google's code to trust, not ours to re-prove. What we
own, and what these tests check, is that our dependency maps every one of
the SDK's failure modes to 401, never a 500 or a silent pass-through.
"""

from unittest.mock import patch

import jwt
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient

WHOAMI = "/api/v1/auth/whoami"


async def test_missing_authorization_header_is_rejected(client: AsyncClient) -> None:
    response = await client.get(WHOAMI)
    assert response.status_code == 401
    assert response.headers["content-type"] == "application/problem+json"


async def test_non_bearer_scheme_is_rejected(client: AsyncClient) -> None:
    response = await client.get(WHOAMI, headers={"Authorization": "Basic dXNlcjpwYXNz"})
    assert response.status_code == 401


async def test_empty_bearer_token_is_rejected(client: AsyncClient) -> None:
    response = await client.get(WHOAMI, headers={"Authorization": "Bearer "})
    assert response.status_code == 401


async def test_structurally_invalid_token_is_rejected(client: AsyncClient) -> None:
    response = await client.get(WHOAMI, headers={"Authorization": "Bearer not.a.real.jwt"})
    assert response.status_code == 401


async def test_wrong_audience_is_rejected(client: AsyncClient) -> None:
    # Well-formed claims, but signed for a different Firebase project. Real
    # verify_id_token(), real rejection — this only needs the token to
    # parse, not to carry a signature our test can forge.
    forged = jwt.encode(
        {
            "iss": "https://securetoken.google.com/some-other-project",
            "aud": "some-other-project",
            "sub": "uid-1",
            "exp": 9999999999,
        },
        "not-a-real-key",
        algorithm="HS256",
    )
    response = await client.get(WHOAMI, headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 401


async def test_expired_token_is_rejected(client: AsyncClient) -> None:
    with patch.object(
        firebase_auth,
        "verify_id_token",
        side_effect=firebase_auth.ExpiredIdTokenError("expired", cause=None),
    ):
        response = await client.get(WHOAMI, headers={"Authorization": "Bearer whatever"})
    assert response.status_code == 401
    assert response.json()["title"] == "Token expired"


async def test_revoked_token_is_rejected(client: AsyncClient) -> None:
    with patch.object(
        firebase_auth,
        "verify_id_token",
        side_effect=firebase_auth.RevokedIdTokenError("revoked"),
    ):
        response = await client.get(WHOAMI, headers={"Authorization": "Bearer whatever"})
    assert response.status_code == 401
    assert response.json()["title"] == "Token revoked"


async def test_valid_token_is_accepted(client: AsyncClient) -> None:
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": "farmer-uid-123", "phone_number": "+919876543210"},
    ):
        response = await client.get(WHOAMI, headers={"Authorization": "Bearer whatever"})
    assert response.status_code == 200
    assert response.json() == {"uid": "farmer-uid-123", "phone_number": "+919876543210"}


async def test_token_missing_uid_claim_is_rejected(client: AsyncClient) -> None:
    with patch.object(firebase_auth, "verify_id_token", return_value={"phone_number": "+91"}):
        response = await client.get(WHOAMI, headers={"Authorization": "Bearer whatever"})
    assert response.status_code == 401
