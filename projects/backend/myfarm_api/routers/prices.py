"""Latest prices for the farmer's crops and price history at one mandi."""

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from statistics import median
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from myfarm_api.core.db import get_session_factory
from myfarm_api.models import Crop, CropCatalog, Farmer, Mandi, PriceReading
from myfarm_api.routers.mandis import followed_mandis, get_current_farmer
from myfarm_api.schemas.mandi import (
    CropPrices,
    LatestPrices,
    MandiPrice,
    MandiRead,
    PriceHistory,
    PricePoint,
)

router = APIRouter(prefix="/api/v1/prices", tags=["prices"])


def _daily_prices(rows: list[tuple[date, Decimal]]) -> dict[date, float]:
    """One price per day: the median of that day's modal prices across varieties and grades."""
    by_day: dict[date, list[float]] = defaultdict(list)
    for day, modal in rows:
        by_day[day].append(float(modal))
    return {day: float(median(values)) for day, values in by_day.items()}


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

        commodities = {c.price_commodity for c in crops if c.price_commodity}
        history: dict[tuple[int, str], dict[date, float]] = {}
        if mandis and commodities:
            stmt = select(
                PriceReading.mandi_id,
                PriceReading.commodity,
                PriceReading.price_date,
                PriceReading.modal_price,
            ).where(
                PriceReading.mandi_id.in_([m.id for m in mandis]),
                PriceReading.commodity.in_(commodities),
            )
            grouped: dict[tuple[int, str], list[tuple[date, Decimal]]] = defaultdict(list)
            for mandi_id, commodity, day, modal in (await session.execute(stmt)).all():
                grouped[(mandi_id, commodity)].append((day, modal))
            history = {key: _daily_prices(rows) for key, rows in grouped.items()}

    result: list[CropPrices] = []
    for crop_id, catalog_id, commodity in crops:
        entries: list[MandiPrice] = []
        for mandi in mandis:
            read = MandiRead.model_validate(mandi)
            days = history.get((mandi.id, commodity or ""), {})
            if not days:
                entries.append(MandiPrice(mandi=read))
                continue
            ordered = sorted(days)
            latest = days[ordered[-1]]
            previous = days[ordered[-2]] if len(ordered) > 1 else None
            change = round((latest - previous) / previous * 100, 1) if previous else None
            entries.append(
                MandiPrice(
                    mandi=read,
                    price=latest,
                    price_date=ordered[-1],
                    previous_price=previous,
                    change_pct=change,
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


@router.get("/history", response_model=PriceHistory)
async def price_history(
    mandi_id: int = Query(ge=1, le=2**63 - 1),
    commodity: str = Query(min_length=1, max_length=100),
    days: Literal[7, 30, 365] = Query(30),
    _farmer: Farmer = Depends(get_current_farmer),
) -> PriceHistory:
    """Daily prices of a commodity at one mandi for the last `days` days, oldest first."""
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

    daily = _daily_prices(rows)
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
