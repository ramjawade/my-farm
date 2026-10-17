"""Mandi price intake: store the rows a fetcher posts, add new mandis, prune old readings."""

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from myfarm_api.core.config import get_settings
from myfarm_api.core.db import get_session_factory
from myfarm_api.core.mandi_feed import FeedRow, parse_record
from myfarm_api.models import CropCatalog, Mandi, PriceReading

CHUNK = 1000
MAX_ROWS_PER_BATCH = 5000


async def mapped_commodities() -> list[str]:
    """The distinct feed commodity names that MyFarm crops map to."""
    async with get_session_factory()() as session:
        stmt = select(CropCatalog.price_commodity).where(CropCatalog.price_commodity.is_not(None))
        names = (await session.execute(stmt)).scalars().all()
    return sorted({n for n in names if n})


async def store_rows(records: list[dict[str, Any]]) -> dict[str, int]:
    """Store a batch of raw feed records in one transaction.

    Rows for another state or for an unmapped commodity are ignored; unparsable rows
    are skipped; both are counted and neither fails the batch. Sending the same rows
    again rewrites the same readings. Old readings are pruned at the end.
    """
    settings = get_settings()
    wanted = set(await mapped_commodities())
    state = settings.mandi_state.strip().lower()

    rows: list[FeedRow] = []
    skipped = ignored = 0
    for record in records:
        row = parse_record(record)
        if row is None:
            skipped += 1
        elif row.state.lower() != state or row.commodity not in wanted:
            ignored += 1
        else:
            rows.append(row)

    mandis_added = 0
    async with get_session_factory()() as session:
        if rows:
            keys = {(r.state, r.district, r.market) for r in rows}
            existing_before = len((await session.execute(select(Mandi.id))).scalars().all())
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
        "received": len(records),
        "stored": len(rows),
        "ignored": ignored,
        "skipped": skipped,
        "mandis_added": mandis_added,
        "readings_pruned": pruned,
    }
