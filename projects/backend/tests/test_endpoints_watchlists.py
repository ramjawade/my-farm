"""Watchlists, the markets-for-a-crop endpoint and has_price on the crop list."""

from datetime import UTC, date, datetime, timedelta
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient
from sqlalchemy import func, select

from myfarm_api.core.config import get_settings
from myfarm_api.core.db import get_session_factory
from myfarm_api.models import CropCatalog, Mandi, WatchlistItem

HEADERS = {"Authorization": "Bearer test"}
ADMIN = {"X-Admin-Token": "s3cret"}
LISTS = "/api/v1/watchlists"


@pytest.fixture(autouse=True)
def _admin_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "admin_token", "s3cret")


def _as(uid: str) -> Any:
    return patch.object(
        firebase_auth, "verify_id_token", return_value={"uid": uid, "phone_number": None}
    )


def _today() -> date:
    return datetime.now(UTC).date()


def _raw(
    market: str, commodity: str, modal: int, day: date | None = None, district: str = "Nashik"
) -> dict[str, Any]:
    return {
        "state": "Maharashtra",
        "district": district,
        "market": market,
        "commodity": commodity,
        "variety": "Local",
        "grade": "FAQ",
        "arrival_date": (day or _today()).strftime("%d/%m/%Y"),
        "min_price": modal - 100,
        "max_price": modal + 100,
        "modal_price": modal,
    }


async def _seed_crop(priced: bool = True) -> tuple[int, str]:
    """A catalog crop with its own unique feed commodity (or none); returns (id, commodity)."""
    commodity = f"Commodity-{uuid4()}"
    async with get_session_factory()() as session:
        crop = CropCatalog(
            name=f"WatchCrop-{uuid4()}", price_commodity=commodity if priced else None
        )
        session.add(crop)
        await session.commit()
        return crop.id, commodity


async def _ingest(client: AsyncClient, rows: list[dict[str, Any]]) -> None:
    resp = await client.post("/api/v1/admin/prices/rows", headers=ADMIN, json={"rows": rows})
    assert resp.status_code == 200


async def _mandi_id(name: str) -> int:
    async with get_session_factory()() as session:
        return (await session.execute(select(Mandi.id).where(Mandi.name == name))).scalar_one()


async def _new_list(client: AsyncClient, name: str | None = None) -> dict[str, Any]:
    resp = await client.post(LISTS, headers=HEADERS, json={"name": name or f"L-{uuid4().hex[:8]}"})
    assert resp.status_code == 201, resp.text
    return resp.json()  # type: ignore[no-any-return]


# ---- lists ----


@pytest.mark.asyncio
async def test_create_list_and_delete_it(client: AsyncClient) -> None:
    with _as(f"farmer_{uuid4()}"):
        created = await _new_list(client, "  Onion markets  ")
        assert created["name"] == "Onion markets" and created["items"] == []

        listed = (await client.get(LISTS, headers=HEADERS)).json()["lists"]
        assert [lst["name"] for lst in listed] == ["Onion markets"]

        assert (await client.delete(f"{LISTS}/{created['id']}", headers=HEADERS)).status_code == 204
        assert (await client.get(LISTS, headers=HEADERS)).json()["lists"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", ["", "   ", "x" * 31])
async def test_a_blank_or_too_long_name_is_refused(client: AsyncClient, bad: str) -> None:
    with _as(f"farmer_{uuid4()}"):
        resp = await client.post(LISTS, headers=HEADERS, json={"name": bad})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_a_name_of_30_characters_is_accepted(client: AsyncClient) -> None:
    with _as(f"farmer_{uuid4()}"):
        assert (
            await client.post(LISTS, headers=HEADERS, json={"name": "y" * 30})
        ).status_code == 201


@pytest.mark.asyncio
async def test_a_repeated_name_in_any_case_is_refused(client: AsyncClient) -> None:
    with _as(f"farmer_{uuid4()}"):
        await _new_list(client, "Onion markets")
        resp = await client.post(LISTS, headers=HEADERS, json={"name": "ONION MARKETS"})
        assert resp.status_code == 409
        assert resp.json()["title"] == "name_taken"


@pytest.mark.asyncio
async def test_my_farm_is_reserved_in_any_case(client: AsyncClient) -> None:
    with _as(f"farmer_{uuid4()}"):
        for name in ("My farm", "my FARM"):
            resp = await client.post(LISTS, headers=HEADERS, json={"name": name})
            assert resp.status_code == 409
            assert resp.json()["title"] == "reserved_name"


@pytest.mark.asyncio
async def test_two_farmers_can_use_the_same_name(client: AsyncClient) -> None:
    with _as(f"a_{uuid4()}"):
        await _new_list(client, "Shared name")
    with _as(f"b_{uuid4()}"):
        await _new_list(client, "Shared name")


@pytest.mark.asyncio
async def test_at_most_ten_lists(client: AsyncClient) -> None:
    with _as(f"farmer_{uuid4()}"):
        for n in range(10):
            await _new_list(client, f"List {n}")
        resp = await client.post(LISTS, headers=HEADERS, json={"name": "One too many"})
        assert resp.status_code == 409
        assert resp.json()["title"] == "list_limit"


# ---- items ----


@pytest.mark.asyncio
async def test_add_an_item_and_see_its_price_and_change(client: AsyncClient) -> None:
    crop_id, commodity = await _seed_crop()
    market = f"Lasalgaon-{uuid4().hex[:6]}"
    await _ingest(
        client,
        [
            _raw(market, commodity, 2020, _today() - timedelta(days=1)),
            _raw(market, commodity, 2150),
        ],
    )
    mandi_id = await _mandi_id(market)

    with _as(f"farmer_{uuid4()}"):
        wl = await _new_list(client)
        added = await client.post(
            f"{LISTS}/{wl['id']}/items",
            headers=HEADERS,
            json={"crop_catalog_id": crop_id, "mandi_id": mandi_id},
        )
        assert added.status_code == 201
        item = added.json()
        assert (item["price"], item["previous_price"], item["change_pct"]) == (2150, 2020, 6.4)
        assert item["price_date"] == _today().isoformat()
        assert item["mandi"]["name"] == market and item["commodity"] == commodity

        listed = (await client.get(LISTS, headers=HEADERS)).json()["lists"][0]
        assert [i["id"] for i in listed["items"]] == [item["id"]]

        removed = await client.delete(f"{LISTS}/{wl['id']}/items/{item['id']}", headers=HEADERS)
        assert removed.status_code == 204
        assert (await client.get(LISTS, headers=HEADERS)).json()["lists"][0]["items"] == []
        gone = await client.delete(f"{LISTS}/{wl['id']}/items/{item['id']}", headers=HEADERS)
        assert gone.status_code == 404


@pytest.mark.asyncio
async def test_a_market_with_no_price_for_the_crop_is_not_traded(client: AsyncClient) -> None:
    crop_id, commodity = await _seed_crop()
    _, other_commodity = await _seed_crop()
    quiet = f"Quiet-{uuid4().hex[:6]}"
    await _ingest(
        client, [_raw(quiet, other_commodity, 1000)]
    )  # the mandi exists, no price for crop
    with _as(f"farmer_{uuid4()}"):
        wl = await _new_list(client)
        resp = await client.post(
            f"{LISTS}/{wl['id']}/items",
            headers=HEADERS,
            json={"crop_catalog_id": crop_id, "mandi_id": await _mandi_id(quiet)},
        )
        assert resp.status_code == 201
        assert resp.json()["price"] is None and resp.json()["price_date"] is None
        assert commodity  # the crop does have a feed name; the market just has no price for it


@pytest.mark.asyncio
async def test_item_errors(client: AsyncClient) -> None:
    crop_id, commodity = await _seed_crop()
    no_price_id, _ = await _seed_crop(priced=False)
    market = f"M-{uuid4().hex[:6]}"
    await _ingest(client, [_raw(market, commodity, 1500)])
    mandi_id = await _mandi_id(market)

    with _as(f"farmer_{uuid4()}"):
        wl = await _new_list(client)
        url = f"{LISTS}/{wl['id']}/items"

        no_price = await client.post(
            url, headers=HEADERS, json={"crop_catalog_id": no_price_id, "mandi_id": mandi_id}
        )
        assert no_price.status_code == 422 and no_price.json()["title"] == "crop_has_no_price"
        assert (
            await client.post(
                url, headers=HEADERS, json={"crop_catalog_id": 2**62, "mandi_id": mandi_id}
            )
        ).status_code == 404
        assert (
            await client.post(
                url, headers=HEADERS, json={"crop_catalog_id": crop_id, "mandi_id": 2**62}
            )
        ).status_code == 404

        body = {"crop_catalog_id": crop_id, "mandi_id": mandi_id}
        assert (await client.post(url, headers=HEADERS, json=body)).status_code == 201
        again = await client.post(url, headers=HEADERS, json=body)
        assert again.status_code == 409 and again.json()["title"] == "duplicate_item"


@pytest.mark.asyncio
async def test_the_same_crop_at_two_markets_is_allowed(client: AsyncClient) -> None:
    crop_id, commodity = await _seed_crop()
    a, b = f"A-{uuid4().hex[:6]}", f"B-{uuid4().hex[:6]}"
    await _ingest(client, [_raw(a, commodity, 1500), _raw(b, commodity, 1600)])
    with _as(f"farmer_{uuid4()}"):
        wl = await _new_list(client)
        for name in (a, b):
            resp = await client.post(
                f"{LISTS}/{wl['id']}/items",
                headers=HEADERS,
                json={"crop_catalog_id": crop_id, "mandi_id": await _mandi_id(name)},
            )
            assert resp.status_code == 201


@pytest.mark.asyncio
async def test_a_list_holds_at_most_twenty_items(client: AsyncClient) -> None:
    crop_id, commodity = await _seed_crop()
    tag = uuid4().hex[:6]
    names = [f"Full{n}-{tag}" for n in range(21)]
    await _ingest(client, [_raw(name, commodity, 1000 + n) for n, name in enumerate(names)])
    with _as(f"farmer_{uuid4()}"):
        wl = await _new_list(client)
        url = f"{LISTS}/{wl['id']}/items"
        for name in names[:20]:
            resp = await client.post(
                url,
                headers=HEADERS,
                json={"crop_catalog_id": crop_id, "mandi_id": await _mandi_id(name)},
            )
            assert resp.status_code == 201
        over = await client.post(
            url,
            headers=HEADERS,
            json={"crop_catalog_id": crop_id, "mandi_id": await _mandi_id(names[20])},
        )
        assert over.status_code == 409 and over.json()["title"] == "item_limit"


@pytest.mark.asyncio
async def test_deleting_a_list_deletes_its_items(client: AsyncClient) -> None:
    crop_id, commodity = await _seed_crop()
    market = f"Del-{uuid4().hex[:6]}"
    await _ingest(client, [_raw(market, commodity, 1500)])
    with _as(f"farmer_{uuid4()}"):
        wl = await _new_list(client)
        await client.post(
            f"{LISTS}/{wl['id']}/items",
            headers=HEADERS,
            json={"crop_catalog_id": crop_id, "mandi_id": await _mandi_id(market)},
        )
        await client.delete(f"{LISTS}/{wl['id']}", headers=HEADERS)
    async with get_session_factory()() as session:
        left = await session.scalar(
            select(func.count())
            .select_from(WatchlistItem)
            .where(WatchlistItem.watchlist_id == wl["id"])
        )
    assert left == 0


# ---- tenancy ----


@pytest.mark.asyncio
async def test_another_farmer_cannot_see_or_change_a_list(client: AsyncClient) -> None:
    crop_id, commodity = await _seed_crop()
    market = f"Own-{uuid4().hex[:6]}"
    await _ingest(client, [_raw(market, commodity, 1500)])
    mandi_id = await _mandi_id(market)

    with _as(f"owner_{uuid4()}"):
        wl = await _new_list(client, "Private")
        item = (
            await client.post(
                f"{LISTS}/{wl['id']}/items",
                headers=HEADERS,
                json={"crop_catalog_id": crop_id, "mandi_id": mandi_id},
            )
        ).json()

    with _as(f"intruder_{uuid4()}"):
        assert (await client.get(LISTS, headers=HEADERS)).json()["lists"] == []
        add = await client.post(
            f"{LISTS}/{wl['id']}/items",
            headers=HEADERS,
            json={"crop_catalog_id": crop_id, "mandi_id": mandi_id},
        )
        assert add.status_code == 404
        remove = await client.delete(f"{LISTS}/{wl['id']}/items/{item['id']}", headers=HEADERS)
        assert remove.status_code == 404
        assert (await client.delete(f"{LISTS}/{wl['id']}", headers=HEADERS)).status_code == 404

    with _as(f"owner2_{uuid4()}"):
        pass  # a different farmer id again: still nothing of the owner's


@pytest.mark.asyncio
async def test_a_removed_item_id_from_another_list_is_not_found(client: AsyncClient) -> None:
    crop_id, commodity = await _seed_crop()
    market = f"Mix-{uuid4().hex[:6]}"
    await _ingest(client, [_raw(market, commodity, 1500)])
    with _as(f"farmer_{uuid4()}"):
        first = await _new_list(client)
        second = await _new_list(client)
        item = (
            await client.post(
                f"{LISTS}/{first['id']}/items",
                headers=HEADERS,
                json={"crop_catalog_id": crop_id, "mandi_id": await _mandi_id(market)},
            )
        ).json()
        wrong = await client.delete(f"{LISTS}/{second['id']}/items/{item['id']}", headers=HEADERS)
        assert wrong.status_code == 404


# ---- markets for a crop and has_price ----


@pytest.mark.asyncio
async def test_markets_for_a_crop_are_best_first_with_district_and_date(
    client: AsyncClient,
) -> None:
    crop_id, commodity = await _seed_crop()
    tag = uuid4().hex[:6]
    await _ingest(
        client,
        [
            _raw(f"Low-{tag}", commodity, 1000, district="Pune"),
            _raw(f"High-{tag}", commodity, 2000, district="Nashik"),
            _raw(f"Mid-{tag}", commodity, 1500),
            _raw(f"Mid-{tag}", commodity, 1700),  # second grade row, median of the day: 1600
        ],
    )
    with _as(f"farmer_{uuid4()}"):
        resp = await client.get(f"/api/v1/prices/crops/{crop_id}/markets", headers=HEADERS)
        assert resp.status_code == 200
        body = resp.json()
        assert body["commodity"] == commodity
        assert [(m["mandi"]["name"], m["price"]) for m in body["markets"]] == [
            (f"High-{tag}", 2000),
            (f"Mid-{tag}", 1600),
            (f"Low-{tag}", 1000),
        ]
        assert body["markets"][0]["mandi"]["district"] == "Nashik"
        assert body["markets"][0]["price_date"] == _today().isoformat()


@pytest.mark.asyncio
async def test_markets_use_each_markets_newest_day_and_respect_the_limit(
    client: AsyncClient,
) -> None:
    crop_id, commodity = await _seed_crop()
    tag = uuid4().hex[:6]
    old = _today() - timedelta(days=5)
    await _ingest(
        client,
        [
            _raw(f"Stale-{tag}", commodity, 9000, old),  # only an old reading
            _raw(f"Changed-{tag}", commodity, 100, old),
            _raw(f"Changed-{tag}", commodity, 1800),  # newest day wins
            _raw(f"Third-{tag}", commodity, 500),
        ],
    )
    with _as(f"farmer_{uuid4()}"):
        body = (
            await client.get(
                f"/api/v1/prices/crops/{crop_id}/markets", headers=HEADERS, params={"limit": 2}
            )
        ).json()
        assert [m["mandi"]["name"] for m in body["markets"]] == [f"Stale-{tag}", f"Changed-{tag}"]
        assert body["markets"][1]["price"] == 1800


@pytest.mark.asyncio
async def test_the_opened_market_is_included_even_outside_the_limit(client: AsyncClient) -> None:
    crop_id, commodity = await _seed_crop()
    tag = uuid4().hex[:6]
    await _ingest(
        client,
        [
            _raw(f"Top-{tag}", commodity, 3000),
            _raw(f"Second-{tag}", commodity, 2000),
            _raw(f"Last-{tag}", commodity, 100),
        ],
    )
    last = await _mandi_id(f"Last-{tag}")
    with _as(f"farmer_{uuid4()}"):
        body = (
            await client.get(
                f"/api/v1/prices/crops/{crop_id}/markets",
                headers=HEADERS,
                params={"limit": 2, "include": last},
            )
        ).json()
        names = [m["mandi"]["name"] for m in body["markets"]]
        assert names == [f"Top-{tag}", f"Last-{tag}"]


@pytest.mark.asyncio
async def test_markets_of_a_crop_with_no_price_are_not_found(client: AsyncClient) -> None:
    no_price_id, _ = await _seed_crop(priced=False)
    with _as(f"farmer_{uuid4()}"):
        for crop_id in (no_price_id, 2**62):
            resp = await client.get(f"/api/v1/prices/crops/{crop_id}/markets", headers=HEADERS)
            assert resp.status_code == 404


@pytest.mark.asyncio
async def test_the_crop_list_says_which_crops_have_a_price(client: AsyncClient) -> None:
    priced_id, _ = await _seed_crop()
    plain_id, _ = await _seed_crop(priced=False)
    with _as(f"farmer_{uuid4()}"):
        items = (await client.get("/api/v1/reference/crops", headers=HEADERS)).json()["items"]
    flags = {c["id"]: c["has_price"] for c in items}
    assert flags[priced_id] is True
    assert flags[plain_id] is False
    assert any(c["name"] == "Onion" and c["has_price"] for c in items)
