"""Latest price, previous price and change for (mandi, commodity) pairs.

One place works these out, so the Prices page, the watchlists and the price detail can
never disagree. A day's price is the median of that day's modal prices across varieties
and grades; the latest price is the newest day, the previous price the day before it that
has a reading (which may be several days earlier).
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from statistics import median

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from myfarm_api.models import PriceReading


@dataclass(frozen=True)
class PriceSnapshot:
    price: float
    price_date: date
    previous_price: float | None
    change_pct: float | None


def daily_prices(rows: Iterable[tuple[date, Decimal]]) -> dict[date, float]:
    """One price per day: the median of that day's modal prices across varieties and grades."""
    by_day: dict[date, list[float]] = defaultdict(list)
    for day, modal in rows:
        by_day[day].append(float(modal))
    return {day: float(median(values)) for day, values in by_day.items()}


def snapshot_from_days(days: dict[date, float]) -> PriceSnapshot | None:
    """The newest day's price, the one before it, and the percentage change; None if no days."""
    if not days:
        return None
    ordered = sorted(days)
    latest = days[ordered[-1]]
    previous = days[ordered[-2]] if len(ordered) > 1 else None
    change = round((latest - previous) / previous * 100, 1) if previous else None
    return PriceSnapshot(
        price=latest, price_date=ordered[-1], previous_price=previous, change_pct=change
    )


async def latest_snapshots(
    session: AsyncSession, pairs: Iterable[tuple[int, str]]
) -> dict[tuple[int, str], PriceSnapshot]:
    """Snapshots for the given (mandi id, commodity) pairs; a pair with no reading is absent."""
    wanted = set(pairs)
    if not wanted:
        return {}
    stmt = select(
        PriceReading.mandi_id,
        PriceReading.commodity,
        PriceReading.price_date,
        PriceReading.modal_price,
    ).where(
        PriceReading.mandi_id.in_({m for m, _ in wanted}),
        PriceReading.commodity.in_({c for _, c in wanted}),
    )
    grouped: dict[tuple[int, str], list[tuple[date, Decimal]]] = defaultdict(list)
    for mandi_id, commodity, day, modal in (await session.execute(stmt)).all():
        if (mandi_id, commodity) in wanted:
            grouped[(mandi_id, commodity)].append((day, modal))
    result: dict[tuple[int, str], PriceSnapshot] = {}
    for key, rows in grouped.items():
        snapshot = snapshot_from_days(daily_prices(rows))
        if snapshot is not None:
            result[key] = snapshot
    return result
