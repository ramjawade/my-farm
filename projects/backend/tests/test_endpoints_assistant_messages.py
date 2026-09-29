"""Chat history endpoints (#286)."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient

from myfarm_api.routers import assistant

URL = "/api/v1/assistant/messages"
AUTH = {"Authorization": "Bearer test"}


@contextmanager
def signed_in(uid: str) -> Iterator[None]:
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        yield


def turn(farmer_text: str, bot_text: str) -> dict[str, Any]:
    return {
        "messages": [
            {"role": "farmer", "text": farmer_text},
            {"role": "bot", "text": bot_text},
        ]
    }


@pytest.mark.asyncio
async def test_append_then_list_newest_first(client: AsyncClient) -> None:
    with signed_in(f"farmer_{uuid4()}"):
        created = await client.post(URL, headers=AUTH, json=turn("hello", "hi there"))
        assert created.status_code == 201
        assert [m["role"] for m in created.json()] == ["farmer", "bot"]
        assert created.json()[0]["kind"] == "text"

        listed = await client.get(URL, headers=AUTH)

    assert listed.status_code == 200
    body = listed.json()
    assert [m["text"] for m in body["items"]] == ["hi there", "hello"]
    assert body["has_more"] is False


@pytest.mark.asyncio
async def test_paging_with_before(client: AsyncClient) -> None:
    with signed_in(f"farmer_{uuid4()}"):
        for i in range(3):
            await client.post(URL, headers=AUTH, json=turn(f"q{i}", f"a{i}"))

        first = (await client.get(URL, headers=AUTH, params={"limit": 4})).json()
        assert [m["text"] for m in first["items"]] == ["a2", "q2", "a1", "q1"]
        assert first["has_more"] is True

        older = (
            await client.get(
                URL,
                headers=AUTH,
                params={"limit": 4, "before": first["items"][-1]["id"]},
            )
        ).json()

    assert [m["text"] for m in older["items"]] == ["a0", "q0"]
    assert older["has_more"] is False


@pytest.mark.asyncio
async def test_brief_kind_is_stored(client: AsyncClient) -> None:
    with signed_in(f"farmer_{uuid4()}"):
        await client.post(
            URL,
            headers=AUTH,
            json={"messages": [{"role": "bot", "kind": "brief", "text": "Good morning"}]},
        )
        listed = await client.get(URL, headers=AUTH)

    assert listed.json()["items"][0]["kind"] == "brief"


@pytest.mark.asyncio
async def test_history_and_clear_are_per_farmer(client: AsyncClient) -> None:
    uid_a = f"farmer_a_{uuid4()}"
    with signed_in(uid_a):
        await client.post(URL, headers=AUTH, json=turn("secret a", "reply a"))

    with signed_in(f"farmer_b_{uuid4()}"):
        # B sees nothing of A's, and clearing B's history must not touch A's.
        assert (await client.get(URL, headers=AUTH)).json() == {
            "items": [],
            "has_more": False,
        }
        assert (await client.delete(URL, headers=AUTH)).status_code == 204

    with signed_in(uid_a):
        listed = await client.get(URL, headers=AUTH)

    assert [m["text"] for m in listed.json()["items"]] == ["reply a", "secret a"]


@pytest.mark.asyncio
async def test_clear_deletes_everything(client: AsyncClient) -> None:
    with signed_in(f"farmer_{uuid4()}"):
        await client.post(URL, headers=AUTH, json=turn("a", "b"))

        cleared = await client.delete(URL, headers=AUTH)
        assert cleared.status_code == 204

        listed = await client.get(URL, headers=AUTH)

    assert listed.json() == {"items": [], "has_more": False}


@pytest.mark.asyncio
async def test_oldest_messages_are_trimmed_over_the_cap(client: AsyncClient) -> None:
    with signed_in(f"farmer_{uuid4()}"), patch.object(assistant, "MAX_MESSAGES_PER_FARMER", 3):
        await client.post(URL, headers=AUTH, json=turn("m1", "m2"))
        await client.post(URL, headers=AUTH, json=turn("m3", "m4"))
        listed = await client.get(URL, headers=AUTH)

    assert [m["text"] for m in listed.json()["items"]] == ["m4", "m3", "m2"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"messages": []},
        {"messages": [{"role": "bot", "text": "x"}] * 3},
        {"messages": [{"role": "robot", "text": "x"}]},
        {"messages": [{"role": "bot", "kind": "poem", "text": "x"}]},
        {"messages": [{"role": "bot", "text": ""}]},
        {"messages": [{"role": "bot", "text": "x" * 4001}]},
    ],
)
async def test_append_rejects_invalid_payload(client: AsyncClient, payload: dict[str, Any]) -> None:
    with signed_in(f"farmer_{uuid4()}"):
        resp = await client.post(URL, headers=AUTH, json=payload)

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient) -> None:
    assert (await client.get(URL)).status_code in (401, 403)
