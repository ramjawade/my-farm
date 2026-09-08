"""PIN session auth (issue #45): register -> JWT -> authenticated /me,
wrong PIN -> 401, and the session JWT satisfies the same dependency the
Firebase token does.
"""

from unittest.mock import patch
from uuid import uuid4

from firebase_admin import auth as firebase_auth
from httpx import AsyncClient


def _phone() -> str:
    # 10 digits, unique per test (phone is UNIQUE in the schema).
    return f"9{uuid4().int % 1_000_000_000:09d}"


async def test_register_then_authenticated_me_returns_the_farmer(client: AsyncClient) -> None:
    phone = _phone()
    resp = await client.post(
        "/api/v1/auth/register",
        json={"phone": phone, "full_name": "Test Farmer", "pin": "1234"},
    )
    assert resp.status_code == 201
    body = resp.json()
    token = body["token"]
    assert body["farmer"]["phone"] == phone
    assert body["farmer"]["auth_uid"].startswith("pin:")

    me = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["id"] == body["farmer"]["id"]
    assert me.json()["full_name"] == "Test Farmer"


async def test_register_duplicate_phone_is_409(client: AsyncClient) -> None:
    phone = _phone()
    first = await client.post(
        "/api/v1/auth/register",
        json={"phone": phone, "full_name": "First", "pin": "1234"},
    )
    assert first.status_code == 201

    dup = await client.post(
        "/api/v1/auth/register",
        json={"phone": phone, "full_name": "Second", "pin": "5678"},
    )
    assert dup.status_code == 409
    assert dup.headers["content-type"] == "application/problem+json"


async def test_session_with_correct_pin_issues_token(client: AsyncClient) -> None:
    phone = _phone()
    await client.post(
        "/api/v1/auth/register",
        json={"phone": phone, "full_name": "Login User", "pin": "246810"},
    )

    resp = await client.post("/api/v1/auth/session", json={"phone": phone, "pin": "246810"})
    assert resp.status_code == 200
    token = resp.json()["token"]

    me = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["phone"] == phone


async def test_session_with_wrong_pin_is_401(client: AsyncClient) -> None:
    phone = _phone()
    await client.post(
        "/api/v1/auth/register",
        json={"phone": phone, "full_name": "Wrong Pin", "pin": "1111"},
    )

    resp = await client.post("/api/v1/auth/session", json={"phone": phone, "pin": "2222"})
    assert resp.status_code == 401
    assert resp.headers["content-type"] == "application/problem+json"


async def test_session_for_unknown_phone_is_401(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/session", json={"phone": _phone(), "pin": "1234"})
    assert resp.status_code == 401


async def test_lookup_reports_existence(client: AsyncClient) -> None:
    phone = _phone()
    assert (await client.get("/api/v1/auth/lookup", params={"phone": phone})).json() == {
        "exists": False
    }
    await client.post(
        "/api/v1/auth/register",
        json={"phone": phone, "full_name": "Lookup User", "pin": "1234"},
    )
    assert (await client.get("/api/v1/auth/lookup", params={"phone": phone})).json() == {
        "exists": True
    }


async def test_malformed_pin_is_rejected_before_any_db_work(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"phone": _phone(), "full_name": "Bad Pin", "pin": "abc"},
    )
    assert resp.status_code == 422


async def test_firebase_token_path_still_works_alongside_session_jwt(client: AsyncClient) -> None:
    uid = f"firebase_user_{uuid4()}"
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": "+919876500000"},
    ):
        resp = await client.get(
            "/api/v1/auth/whoami", headers={"Authorization": "Bearer fb-token"}
        )
    assert resp.status_code == 200
    assert resp.json()["uid"] == uid


async def test_session_jwt_rejected_when_secret_not_configured(client: AsyncClient) -> None:
    phone = _phone()
    reg = await client.post(
        "/api/v1/auth/register",
        json={"phone": phone, "full_name": "No Secret", "pin": "1234"},
    )
    token = reg.json()["token"]

    from myfarm_api.core import config

    config.get_settings.cache_clear()
    with patch.dict("os.environ", {"SESSION_JWT_SECRET": ""}):
        try:
            me = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
            assert me.status_code == 401
        finally:
            config.get_settings.cache_clear()
