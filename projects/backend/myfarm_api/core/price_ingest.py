"""Daily mandi price ingest: fetch the mapped commodities, store readings, prune old ones."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from myfarm_api.core.config import get_settings
from myfarm_api.core.db import get_session_factory
from myfarm_api.core.mandi_feed import FeedRow
from myfarm_api.models import CropCatalog, Mandi, PriceReading

logger = logging.getLogger(__name__)

CHUNK = 1000


class Feed(Protocol):
    async def fetch_commodity(self, commodity: str) -> tuple[list[FeedRow], int]: ...


async def mapped_commodities() -> list[str]:
    """The distinct feed commodity names that MyFarm crops map to."""
    async with get_session_factory()() as session:
        stmt = select(CropCatalog.price_commodity).where(CropCatalog.price_commodity.is_not(None))
        names = (await session.execute(stmt)).scalars().all()
    return sorted({n for n in names if n})


async def run_ingest(feed: Feed) -> dict[str, Any]:
    """Fetch every mapped commodity, then store the lot in one transaction.

    Everything is fetched before anything is written, so a feed failure (which
    raises) leaves earlier readings untouched. Rerunning for the same day
    rewrites the same rows.
    """
    settings = get_settings()
    commodities = await mapped_commodities()

    rows: list[FeedRow] = []
    per_commodity: dict[str, int] = {}
    skipped = 0
    for commodity in commodities:
        fetched, bad = await feed.fetch_commodity(commodity)
        rows.extend(fetched)
        skipped += bad
        per_commodity[commodity] = len(fetched)

    unmatched = sorted(name for name, count in per_commodity.items() if count == 0)
    if unmatched:
        logger.warning("mandi feed returned no rows for commodities: %s", unmatched)

    mandis_added = 0
    async with get_session_factory()() as session:
        if rows:
            keys = {(r.state, r.district, r.market) for r in rows}
            existing_before = await _count_mandis(session)
            mandi_values = [{"state": s, "district": d, "name": n} for s, d, n in keys]
            for start in range(0, len(mandi_values), CHUNK):
                await session.execute(
                    insert(Mandi)
                    .values(mandi_values[start : start + CHUNK])
                    .on_conflict_do_nothing(constraint="uq_mandi_state_district_name")
                )
            mandi_ids = {
                (m.state, m.district, m.name): m.id
                for m in (await session.execute(select(Mandi))).scalars().all()
            }
            mandis_added = len(mandi_ids) - existing_before

            # One row per unique key: the feed can repeat a record within a day.
            unique: dict[tuple[int, str, str, str, Any], dict[str, Any]] = {}
            for r in rows:
                mandi_id = mandi_ids[(r.state, r.district, r.market)]
                key = (mandi_id, r.commodity, r.variety, r.grade, r.price_date)
                unique[key] = {
                    "mandi_id": mandi_id,
                    "commodity": r.commodity,
                    "variety": r.variety,
                    "grade": r.grade,
                    "price_date": r.price_date,
                    "min_price": r.min_price,
                    "max_price": r.max_price,
                    "modal_price": r.modal_price,
                }
            values = list(unique.values())
            # Chunked: asyncpg allows at most 32,767 bind parameters per statement.
            for start in range(0, len(values), CHUNK):
                stmt = insert(PriceReading).values(values[start : start + CHUNK])
                await session.execute(
                    stmt.on_conflict_do_update(
                        constraint="uq_price_reading_key",
                        set_={
                            "min_price": stmt.excluded.min_price,
                            "max_price": stmt.excluded.max_price,
                            "modal_price": stmt.excluded.modal_price,
                        },
                    )
                )

        cutoff = datetime.now(UTC).date() - timedelta(days=settings.price_retention_days)
        result = await session.execute(delete(PriceReading).where(PriceReading.price_date < cutoff))
        pruned = getattr(result, "rowcount", 0) or 0
        await session.commit()

    return {
        "commodities": per_commodity,
        "unmatched_commodities": unmatched,
        "rows_fetched": len(rows),
        "rows_skipped": skipped,
        "mandis_added": mandis_added,
        "readings_pruned": pruned,
    }


async def _count_mandis(session: Any) -> int:
    return len((await session.execute(select(Mandi.id))).scalars().all())
