"""Latest prices for the farmer's crops and price history at one mandi."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select

from myfarm_api.core.db import get_session_factory
from myfarm_api.core.price_lookup import daily_prices, latest_snapshots
from myfarm_api.models import Crop, CropCatalog, Farmer, Mandi, PriceReading
from myfarm_api.routers.mandis import followed_mandis, get_current_farmer
from myfarm_api.schemas.common import DbId
from myfarm_api.schemas.mandi import (
    CropMarket,
    CropMarkets,
    CropPrices,
    LatestPrices,
    MandiPrice,
    MandiRead,
    PriceHistory,
    PricePoint,
)

router = APIRouter(prefix="/api/v1/prices", tags=["prices"])

HISTORY_PERIODS = (7, 30, 365)


@router.get("/latest", response_model=LatestPrices)
async def latest_prices(
    current_farmer: Farmer = Depends(get_current_farmer),
) -> LatestPrices:
    """Each of the farmer's crops with its latest price at every followed mandi."""
    mandis, _ = await followed_mandis(current_farmer.id)
    async with get_session_factory()() as session:
        crop_stmt = (
            select(Crop.id, Crop.crop_catalog_id, CropCatalog.price_commodity)
            .join(CropCatalog, CropCatalog.id == Crop.crop_catalog_id)
            .where(Crop.farmer_id == current_farmer.id, Crop.deleted_at.is_(None))
            .order_by(Crop.id)
        )
        crops = (await session.execute(crop_stmt)).all()
        pairs = [(m.id, c.price_commodity) for m in mandis for c in crops if c.price_commodity]
        snapshots = await latest_snapshots(session, pairs)

    result: list[CropPrices] = []
    for crop_id, catalog_id, commodity in crops:
        entries: list[MandiPrice] = []
        for mandi in mandis:
            read = MandiRead.model_validate(mandi)
            snap = snapshots.get((mandi.id, commodity or ""))
            if snap is None:
                entries.append(MandiPrice(mandi=read))
                continue
            entries.append(
                MandiPrice(
                    mandi=read,
                    price=snap.price,
                    price_date=snap.price_date,
                    previous_price=snap.previous_price,
                    change_pct=snap.change_pct,
                )
            )
        result.append(
            CropPrices(
                crop_id=crop_id,
                crop_catalog_id=catalog_id,
                commodity=commodity,
                mandis=entries,
            )
        )
    return LatestPrices(crops=result)


@router.get("/crops/{crop_catalog_id}/markets", response_model=CropMarkets)
async def crop_markets(
    crop_catalog_id: DbId,
    limit: int = Query(20, ge=1, le=50),
    include: int | None = Query(None, ge=1, le=2**63 - 1),
    _farmer: Farmer = Depends(get_current_farmer),
) -> CropMarkets:
    """The markets that have a price for a crop, best price first.

    `include` names a market that must be in the answer when it has a price, even if it
    falls outside the first `limit` (the market the farmer opened).
    """
    async with get_session_factory()() as session:
        crop = await session.get(CropCatalog, crop_catalog_id)
        if crop is None or not crop.price_commodity:
            raise HTTPException(status_code=404, detail="No price for this crop")
        commodity = crop.price_commodity

        newest = (
            select(PriceReading.mandi_id, func.max(PriceReading.price_date).label("day"))
            .where(PriceReading.commodity == commodity)
            .group_by(PriceReading.mandi_id)
            .subquery()
        )
        stmt = (
            select(PriceReading.mandi_id, PriceReading.price_date, PriceReading.modal_price)
            .join(
                newest,
                and_(
                    PriceReading.mandi_id == newest.c.mandi_id,
                    PriceReading.price_date == newest.c.day,
                ),
            )
            .where(PriceReading.commodity == commodity)
        )
        per_mandi: dict[int, list[tuple[date, Decimal]]] = {}
        for mandi_id, day, modal in (await session.execute(stmt)).all():
            per_mandi.setdefault(mandi_id, []).append((day, modal))
        priced = {
            mandi_id: (max(rows)[0], daily_prices(rows)[max(rows)[0]])
            for mandi_id, rows in per_mandi.items()
        }
        mandis = {
            m.id: m
            for m in (
                await session.execute(select(Mandi).where(Mandi.id.in_(list(priced) or [0])))
            )
            .scalars()
            .all()
        }

    ranked = sorted(priced, key=lambda mid: (-priced[mid][1], mandis[mid].name, mid))
    chosen = ranked[:limit]
    if include is not None and include in priced and include not in chosen:
        chosen = [*chosen[: limit - 1], include] if limit > 1 else [include]
    async with get_session_factory()() as session:
        snapshots = await latest_snapshots(session, [(mid, commodity) for mid in chosen])
    markets: list[CropMarket] = []
    for mid in chosen:
        snap = snapshots.get((mid, commodity))
        markets.append(
            CropMarket(
                mandi=MandiRead.model_validate(mandis[mid]),
                price=priced[mid][1],
                price_date=priced[mid][0],
                previous_price=snap.previous_price if snap else None,
                change_pct=snap.change_pct if snap else None,
            )
        )
    return CropMarkets(crop_catalog_id=crop_catalog_id, commodity=commodity, markets=markets)


@router.get("/history", response_model=PriceHistory)
async def price_history(
    mandi_id: int = Query(ge=1, le=2**63 - 1),
    commodity: str = Query(min_length=1, max_length=100),
    days: int = Query(30),
    _farmer: Farmer = Depends(get_current_farmer),
) -> PriceHistory:
    """Daily prices of a commodity at one mandi for the last `days` days, oldest first."""
    # An int checked here, not a Literal: query strings arrive as text ("7") and a
    # Literal[7, 30, 365] would reject them.
    if days not in HISTORY_PERIODS:
        raise HTTPException(status_code=422, detail="days must be 7, 30 or 365")
    since = datetime.now(UTC).date() - timedelta(days=days)
    async with get_session_factory()() as session:
        mandi = await session.get(Mandi, mandi_id)
        if mandi is None:
            raise HTTPException(status_code=404, detail="Mandi not found")
        stmt = select(PriceReading.price_date, PriceReading.modal_price).where(
            PriceReading.mandi_id == mandi_id,
            PriceReading.commodity == commodity,
            PriceReading.price_date >= since,
        )
        rows = [(d, m) for d, m in (await session.execute(stmt)).all()]

    daily = daily_prices(rows)
    points = [PricePoint(date=d, price=p) for d, p in sorted(daily.items())]
    prices = [p.price for p in points]
    return PriceHistory(
        mandi=MandiRead.model_validate(mandi),
        commodity=commodity,
        days=days,
        points=points,
        lowest=min(prices) if prices else None,
        average=round(sum(prices) / len(prices), 2) if prices else None,
        highest=max(prices) if prices else None,
    )
