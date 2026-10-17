"""The predefined crop list and private custom crops."""

import importlib.util
from pathlib import Path
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient

from myfarm_api.core.crop_seed import CATEGORIES, PREDEFINED_CROPS

HEADERS = {"Authorization": "Bearer test"}
URL = "/api/v1/reference/crops"


def _as(uid: str) -> Any:
    return patch.object(
        firebase_auth, "verify_id_token", return_value={"uid": uid, "phone_number": None}
    )


async def _names(client: AsyncClient, signed_in: bool = True) -> dict[str, dict[str, Any]]:
    resp = await client.get(URL, headers=HEADERS if signed_in else {})
    assert resp.status_code == 200
    return {c["name"]: c for c in resp.json()["items"]}


def test_migration_list_matches_the_backend_list() -> None:
    """Migration 0010 carries its own copy of the crop list; the two must agree."""
    versions = Path(__file__).resolve().parent.parent / "migrations" / "versions"
    path = versions / "0010_crop_catalog.py"
    spec = importlib.util.spec_from_file_location("migration_0010", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.PREDEFINED == [tuple(c) for c in PREDEFINED_CROPS]
    assert module.RENAMES == {"Corn": "Maize", "Soybeans": "Soybean"}
    assert {c.category for c in PREDEFINED_CROPS} <= set(CATEGORIES)
    names = [c.name.lower() for c in PREDEFINED_CROPS]
    assert len(names) == len(set(names))


@pytest.mark.asyncio
async def test_new_farmer_sees_the_whole_predefined_list(client: AsyncClient) -> None:
    with _as(f"farmer_{uuid4()}"):
        crops = await _names(client)
    for seed in PREDEFINED_CROPS:
        assert seed.name in crops, seed.name
        assert crops[seed.name]["custom"] is False
        assert crops[seed.name]["category"] == seed.category


@pytest.mark.asyncio
async def test_list_without_a_token_is_the_predefined_crops_only(client: AsyncClient) -> None:
    name = f"Private-{uuid4()}"
    with _as(f"farmer_{uuid4()}"):
        await client.post(URL, headers=HEADERS, json={"name": name})
        assert name in await _names(client)
    anonymous = await _names(client, signed_in=False)
    assert name not in anonymous
    assert "Onion" in anonymous


@pytest.mark.asyncio
async def test_a_custom_crop_is_private_to_its_farmer(client: AsyncClient) -> None:
    name = f"Dragon fruit {uuid4()}"
    with _as(f"owner_{uuid4()}"):
        created = await client.post(URL, headers=HEADERS, json={"name": name})
        assert created.status_code == 200
        assert created.json()["custom"] is True
        assert (await _names(client))[name]["custom"] is True
    with _as(f"other_{uuid4()}"):
        assert name not in await _names(client)


@pytest.mark.asyncio
async def test_two_farmers_can_each_add_the_same_custom_name(client: AsyncClient) -> None:
    name = f"Jackfruit {uuid4()}"
    with _as(f"a_{uuid4()}"):
        first = (await client.post(URL, headers=HEADERS, json={"name": name})).json()
    with _as(f"b_{uuid4()}"):
        second = (await client.post(URL, headers=HEADERS, json={"name": name})).json()
    assert first["id"] != second["id"]


@pytest.mark.asyncio
async def test_a_predefined_name_in_any_case_uses_the_predefined_crop(
    client: AsyncClient,
) -> None:
    with _as(f"farmer_{uuid4()}"):
        before = await _names(client)
        resp = await client.post(URL, headers=HEADERS, json={"name": "  onion "})
        assert resp.status_code == 200
        assert resp.json()["id"] == before["Onion"]["id"]
        assert resp.json()["custom"] is False
        assert resp.json()["name"] == "Onion"
        assert len(await _names(client)) == len(before)


@pytest.mark.asyncio
async def test_the_same_custom_name_in_another_case_is_the_same_crop(client: AsyncClient) -> None:
    name = f"Starfruit {uuid4()}"
    with _as(f"farmer_{uuid4()}"):
        first = (await client.post(URL, headers=HEADERS, json={"name": name})).json()
        again = (await client.post(URL, headers=HEADERS, json={"name": name.upper()})).json()
    assert again["id"] == first["id"]
    assert again["name"] == name


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", ["", "   ", "x" * 101])
async def test_blank_and_too_long_names_are_refused(client: AsyncClient, bad: str) -> None:
    with _as(f"farmer_{uuid4()}"):
        resp = await client.post(URL, headers=HEADERS, json={"name": bad})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_a_name_of_exactly_100_characters_is_accepted(client: AsyncClient) -> None:
    name = ("y" * 64) + uuid4().hex[:32] + "zzzz"
    assert len(name) == 100
    with _as(f"farmer_{uuid4()}"):
        resp = await client.post(URL, headers=HEADERS, json={"name": name})
        assert resp.status_code == 200
