"""Mandi price ingest, mandi finder, followed mandis, latest prices and history."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient
from sqlalchemy import select

from myfarm_api.core.config import get_settings
from myfarm_api.core.db import get_session_factory
from myfarm_api.core.mandi_feed import FeedError, FeedRow
from myfarm_api.models import CropCatalog, Mandi, PriceReading

HEADERS = {"Authorization": "Bearer test"}
ADMIN = {"X-Admin-Token": "s3cret"}
STATE = "Maharashtra"


def _today() -> date:
    return datetime.now(UTC).date()


def _row(
    district: str,
    market: str,
    commodity: str,
    modal: int,
    day: date | None = None,
    variety: str = "Local",
    grade: str = "FAQ",
) -> FeedRow:
    return FeedRow(
        state=STATE,
        district=district,
        market=market,
        commodity=commodity,
        variety=variety,
        grade=grade,
        price_date=day or _today(),
        min_price=Decimal(modal - 100),
        max_price=Decimal(modal + 100),
        modal_price=Decimal(modal),
    )


class FakeFeed:
    """Answers each commodity from a fixed list of rows; raises if told to fail."""

    def __init__(self, rows: list[FeedRow], fail: bool = False) -> None:
        self.rows = rows
        self.fail = fail

    async def fetch_commodity(self, commodity: str) -> tuple[list[FeedRow], int]:
        if self.fail:
            raise FeedError("feed down")
        return [r for r in self.rows if r.commodity == commodity], 0


@pytest.fixture(autouse=True)
def _feed_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "admin_token", "s3cret")
    monkeypatch.setattr(get_settings(), "mandi_api_key", "test-key")


def _as(uid: str) -> Any:
    return patch.object(
        firebase_auth, "verify_id_token", return_value={"uid": uid, "phone_number": None}
    )


async def _seed_crop_type() -> tuple[int, str]:
    """A crop_catalog row with its own unique feed commodity; returns (id, commodity)."""
    commodity = f"Commodity-{uuid4()}"
    async with get_session_factory()() as session:
        crop = CropCatalog(name=f"PriceCrop-{uuid4()}", price_commodity=commodity)
        session.add(crop)
        await session.commit()
        return crop.id, commodity


async def _ingest(client: AsyncClient, rows: list[FeedRow], fail: bool = False) -> Any:
    with patch("myfarm_api.routers.admin.get_mandi_feed", return_value=FakeFeed(rows, fail)):
        return await client.post("/api/v1/admin/prices/ingest", headers=ADMIN)


async def _count(commodity: str) -> int:
    async with get_session_factory()() as session:
        stmt = select(PriceReading).where(PriceReading.commodity == commodity)
        return len((await session.execute(stmt)).scalars().all())


async def _mandi_id(name: str) -> int:
    async with get_session_factory()() as session:
        return (await session.execute(select(Mandi.id).where(Mandi.name == name))).scalar_one()


# ---- ingest ----


@pytest.mark.asyncio
async def test_ingest_needs_the_admin_token(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/admin/prices/ingest")
    assert resp.status_code in (401, 403)
    resp = await client.post("/api/v1/admin/prices/ingest", headers={"X-Admin-Token": "wrong"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_ingest_without_a_key_is_unavailable(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "mandi_api_key", "")
    resp = await client.post("/api/v1/admin/prices/ingest", headers=ADMIN)
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_ingest_stores_rows_and_is_safe_to_rerun(client: AsyncClient) -> None:
    _, commodity = await _seed_crop_type()
    district, market = f"District-{uuid4()}", f"Market-{uuid4()}"
    rows = [
        _row(district, market, commodity, 2100),
        _row(district, market, commodity, 2000, variety="Hybrid", grade="Non-FAQ"),
    ]

    first = await _ingest(client, rows)
    assert first.status_code == 200
    assert first.json()["commodities"][commodity] == 2
    assert first.json()["mandis_added"] >= 1
    assert await _count(commodity) == 2

    second = await _ingest(client, rows)
    assert second.status_code == 200
    assert second.json()["mandis_added"] == 0
    assert await _count(commodity) == 2


@pytest.mark.asyncio
async def test_ingest_reports_commodities_with_no_rows(client: AsyncClient) -> None:
    _, commodity = await _seed_crop_type()
    resp = await _ingest(client, [])
    assert commodity in resp.json()["unmatched_commodities"]


@pytest.mark.asyncio
async def test_feed_failure_changes_nothing(client: AsyncClient) -> None:
    _, commodity = await _seed_crop_type()
    market = f"Market-{uuid4()}"
    await _ingest(client, [_row("D", market, commodity, 2100)])
    assert await _count(commodity) == 1

    resp = await _ingest(client, [_row("D", market, commodity, 9999)], fail=True)
    assert resp.status_code == 502
    assert await _count(commodity) == 1


@pytest.mark.asyncio
async def test_ingest_prunes_old_readings(client: AsyncClient) -> None:
    _, commodity = await _seed_crop_type()
    market = f"Market-{uuid4()}"
    await _ingest(client, [_row("D", market, commodity, 2100)])
    mandi_id = await _mandi_id(market)
    old = _today() - timedelta(days=get_settings().price_retention_days + 5)
    async with get_session_factory()() as session:
        session.add(
            PriceReading(
                mandi_id=mandi_id,
                commodity=commodity,
                variety="Local",
                grade="FAQ",
                price_date=old,
                min_price=Decimal(1),
                max_price=Decimal(2),
                modal_price=Decimal(1),
            )
        )
        await session.commit()
    assert await _count(commodity) == 2

    await _ingest(client, [])
    assert await _count(commodity) == 1  # the recent reading stays


# ---- finder ----


@pytest.mark.asyncio
async def test_find_mandis_by_district_name_and_commodity(client: AsyncClient) -> None:
    _, priced = await _seed_crop_type()
    tag = uuid4().hex[:8]
    district = f"Dist{tag}"
    await _ingest(
        client,
        [_row(district, f"Alpha{tag}", priced, 2100), _row(district, f"Beta{tag}", priced, 2000)],
    )
    # a mandi in the same district that has no price for `priced`
    async with get_session_factory()() as session:
        session.add(Mandi(state=STATE, district=district, name=f"Gamma{tag}"))
        await session.commit()

    with _as(f"farmer_{uuid4()}"):
        districts = (await client.get("/api/v1/mandis/districts", headers=HEADERS)).json()["items"]
        assert district in districts
        assert districts == sorted(districts)

        in_district = await client.get(
            "/api/v1/mandis", headers=HEADERS, params={"district": district.lower()}
        )
        assert [m["name"] for m in in_district.json()["items"]] == [
            f"Alpha{tag}",
            f"Beta{tag}",
            f"Gamma{tag}",
        ]

        searched = await client.get("/api/v1/mandis", headers=HEADERS, params={"q": f"BETA{tag}"})
        assert [m["name"] for m in searched.json()["items"]] == [f"Beta{tag}"]

        trading = await client.get(
            "/api/v1/mandis", headers=HEADERS, params={"district": district, "commodity": priced}
        )
        assert [m["name"] for m in trading.json()["items"]] == [f"Alpha{tag}", f"Beta{tag}"]

        nothing = await client.get("/api/v1/mandis", headers=HEADERS, params={"q": f"zz{tag}zz"})
        assert nothing.json()["items"] == []


@pytest.mark.asyncio
async def test_mandis_outside_the_configured_state_are_not_offered(client: AsyncClient) -> None:
    tag = uuid4().hex[:8]
    async with get_session_factory()() as session:
        session.add(Mandi(state="Elsewhere", district=f"D{tag}", name=f"Far{tag}"))
        await session.commit()
    with _as(f"farmer_{uuid4()}"):
        resp = await client.get("/api/v1/mandis", headers=HEADERS, params={"q": f"Far{tag}"})
        assert resp.json()["items"] == []


# ---- followed mandis ----


async def _three_mandis(client: AsyncClient) -> tuple[str, list[int], str]:
    _, commodity = await _seed_crop_type()
    tag = uuid4().hex[:8]
    district = f"Dist{tag}"
    names = [f"M1{tag}", f"M2{tag}", f"M3{tag}"]
    await _ingest(client, [_row(district, n, commodity, 2000 + i) for i, n in enumerate(names)])
    return district, [await _mandi_id(n) for n in names], commodity


@pytest.mark.asyncio
async def test_follow_mandis_in_order_and_replace(client: AsyncClient) -> None:
    _, ids, _ = await _three_mandis(client)
    with _as(f"farmer_{uuid4()}"):
        put = await client.put(
            "/api/v1/me/mandis", headers=HEADERS, json={"mandi_ids": [ids[2], ids[0], ids[1]]}
        )
        assert put.status_code == 200
        got = (await client.get("/api/v1/me/mandis", headers=HEADERS)).json()
        assert [m["id"] for m in got["items"]] == [ids[2], ids[0], ids[1]]
        assert got["suggested"] is False

        await client.put("/api/v1/me/mandis", headers=HEADERS, json={"mandi_ids": [ids[1]]})
        got = (await client.get("/api/v1/me/mandis", headers=HEADERS)).json()
        assert [m["id"] for m in got["items"]] == [ids[1]]


@pytest.mark.asyncio
async def test_follow_rejects_bad_lists_and_keeps_the_old_one(client: AsyncClient) -> None:
    _, ids, _ = await _three_mandis(client)
    with _as(f"farmer_{uuid4()}"):
        await client.put("/api/v1/me/mandis", headers=HEADERS, json={"mandi_ids": [ids[0]]})

        bad_lists: list[list[int]] = [[], [1, 2, 3, 4, 5, 6], [ids[0], ids[0]]]
        for bad in bad_lists:
            resp = await client.put("/api/v1/me/mandis", headers=HEADERS, json={"mandi_ids": bad})
            assert resp.status_code == 422
        unknown = await client.put(
            "/api/v1/me/mandis", headers=HEADERS, json={"mandi_ids": [2**62]}
        )
        assert unknown.status_code == 404

        got = (await client.get("/api/v1/me/mandis", headers=HEADERS)).json()
        assert [m["id"] for m in got["items"]] == [ids[0]]


@pytest.mark.asyncio
async def test_one_farmers_mandis_are_not_visible_to_another(client: AsyncClient) -> None:
    _, ids, _ = await _three_mandis(client)
    with _as(f"owner_{uuid4()}"):
        await client.put("/api/v1/me/mandis", headers=HEADERS, json={"mandi_ids": ids})
    with _as(f"other_{uuid4()}"):
        got = (await client.get("/api/v1/me/mandis", headers=HEADERS)).json()
        assert got["items"] == [] and got["suggested"] is True


async def _farm_with_crop(client: AsyncClient, district: str, catalog_id: int) -> None:
    farm = await client.post(
        "/api/v1/farms", headers=HEADERS, json={"name": "F", "state": STATE, "district": district}
    )
    land = await client.post(
        "/api/v1/lands", headers=HEADERS, json={"name": "L", "farm_id": str(farm.json()["id"])}
    )
    crop = await client.post(
        "/api/v1/crops",
        headers=HEADERS,
        json={"name": "C", "land_id": str(land.json()["id"]), "crop_catalog_id": str(catalog_id)},
    )
    assert crop.status_code == 201


@pytest.mark.asyncio
async def test_default_mandis_come_from_the_farm_district(client: AsyncClient) -> None:
    catalog_id, commodity = await _seed_crop_type()
    tag = uuid4().hex[:8]
    district = f"Dist{tag}"
    names = [f"A{tag}", f"B{tag}", f"C{tag}", f"D{tag}"]
    await _ingest(client, [_row(district, n, commodity, 2000) for n in names])
    async with get_session_factory()() as session:  # no price for this crop: not a default
        session.add(Mandi(state=STATE, district=district, name=f"Unpriced{tag}"))
        await session.commit()

    with _as(f"farmer_{uuid4()}"):
        await _farm_with_crop(client, district.upper(), catalog_id)
        got = (await client.get("/api/v1/me/mandis", headers=HEADERS)).json()
        assert got["suggested"] is True
        assert [m["name"] for m in got["items"]] == names[:3]


@pytest.mark.asyncio
async def test_no_district_means_no_defaults(client: AsyncClient) -> None:
    catalog_id, commodity = await _seed_crop_type()
    await _ingest(client, [_row("D", f"M{uuid4().hex[:8]}", commodity, 2000)])
    with _as(f"farmer_{uuid4()}"):
        await _farm_with_crop(client, "", catalog_id)
        got = (await client.get("/api/v1/me/mandis", headers=HEADERS)).json()
        assert got == {"items": [], "suggested": True}


# ---- latest and history ----


@pytest.mark.asyncio
async def test_latest_price_change_not_traded_and_no_price(client: AsyncClient) -> None:
    catalog_id, commodity = await _seed_crop_type()
    tag = uuid4().hex[:8]
    market, other = f"Priced{tag}", f"Quiet{tag}"
    yesterday = _today() - timedelta(days=1)
    await _ingest(
        client,
        [
            _row("D", market, commodity, 2020, day=yesterday),
            _row("D", market, commodity, 2150),
            _row("D", market, commodity, 2250, variety="Other", grade="B"),  # median of 2150, 2250
        ],
    )
    async with get_session_factory()() as session:
        session.add(Mandi(state=STATE, district="D", name=other))
        no_price_type = CropCatalog(name=f"NoPrice-{uuid4()}")
        session.add(no_price_type)
        await session.commit()
        no_price_id = no_price_type.id
    ids = [await _mandi_id(market), await _mandi_id(other)]

    with _as(f"farmer_{uuid4()}"):
        await _farm_with_crop(client, "D", catalog_id)
        await _farm_with_crop(client, "D", no_price_id)
        await client.put("/api/v1/me/mandis", headers=HEADERS, json={"mandi_ids": ids})

        crops = (await client.get("/api/v1/prices/latest", headers=HEADERS)).json()["crops"]
        priced = next(c for c in crops if c["commodity"] == commodity)
        at_market, at_other = priced["mandis"]
        assert at_market["price"] == 2200  # median of the day's 2150 and 2250
        assert at_market["previous_price"] == 2020
        assert at_market["change_pct"] == 8.9
        assert at_market["price_date"] == _today().isoformat()
        assert at_other["price"] is None  # not traded there

        unpriced = next(c for c in crops if c["commodity"] is None)
        assert all(m["price"] is None for m in unpriced["mandis"])


@pytest.mark.asyncio
async def test_latest_price_from_an_older_day_carries_its_date(client: AsyncClient) -> None:
    catalog_id, commodity = await _seed_crop_type()
    market = f"Old{uuid4().hex[:8]}"
    three_days_ago = _today() - timedelta(days=3)
    await _ingest(client, [_row("D", market, commodity, 1800, day=three_days_ago)])
    with _as(f"farmer_{uuid4()}"):
        await _farm_with_crop(client, "D", catalog_id)
        await client.put(
            "/api/v1/me/mandis", headers=HEADERS, json={"mandi_ids": [await _mandi_id(market)]}
        )
        crops = (await client.get("/api/v1/prices/latest", headers=HEADERS)).json()["crops"]
        entry = crops[0]["mandis"][0]
        assert entry["price"] == 1800
        assert entry["price_date"] == three_days_ago.isoformat()
        assert entry["change_pct"] is None


@pytest.mark.asyncio
async def test_history_periods_figures_and_errors(client: AsyncClient) -> None:
    _, commodity = await _seed_crop_type()
    market = f"Hist{uuid4().hex[:8]}"
    rows = [
        _row("D", market, commodity, 2000 + step * 100, day=_today() - timedelta(days=offset))
        for step, offset in enumerate([40, 20, 5, 0])
    ]
    await _ingest(client, rows)
    mandi_id = await _mandi_id(market)

    with _as(f"farmer_{uuid4()}"):
        params: dict[str, Any] = {"mandi_id": mandi_id, "commodity": commodity}
        thirty = (await client.get("/api/v1/prices/history", headers=HEADERS, params=params)).json()
        assert thirty["days"] == 30
        assert [p["price"] for p in thirty["points"]] == [2100, 2200, 2300]  # oldest first
        assert (thirty["lowest"], thirty["average"], thirty["highest"]) == (2100, 2200, 2300)

        week = await client.get(
            "/api/v1/prices/history", headers=HEADERS, params={**params, "days": 7}
        )
        assert [p["price"] for p in week.json()["points"]] == [2200, 2300]

        year = await client.get(
            "/api/v1/prices/history", headers=HEADERS, params={**params, "days": 365}
        )
        assert len(year.json()["points"]) == 4

        bad = await client.get(
            "/api/v1/prices/history", headers=HEADERS, params={**params, "days": 14}
        )
        assert bad.status_code == 422
        missing = await client.get(
            "/api/v1/prices/history", headers=HEADERS, params={**params, "mandi_id": 2**62}
        )
        assert missing.status_code == 404


@pytest.mark.asyncio
async def test_history_with_only_one_reading(client: AsyncClient) -> None:
    _, commodity = await _seed_crop_type()
    market = f"One{uuid4().hex[:8]}"
    await _ingest(client, [_row("D", market, commodity, 1500)])
    with _as(f"farmer_{uuid4()}"):
        resp = await client.get(
            "/api/v1/prices/history",
            headers=HEADERS,
            params={"mandi_id": await _mandi_id(market), "commodity": commodity},
        )
        body = resp.json()
        assert resp.status_code == 200 and len(body["points"]) == 1
        assert body["lowest"] == body["highest"] == 1500
