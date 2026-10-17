"""Client for the data.gov.in mandi price feed (Agmarknet, daily prices).

Contract (the dataset's API tab): `GET <resource url>` with the query
parameters `api-key`, `format=json`, `offset`, `limit` and exact-match
`filters[state.keyword]`, `filters[district]`, `filters[market]`,
`filters[commodity]`, `filters[variety]`, `filters[grade]`. The reply is
`{status, total, count, limit, offset, records[]}`; each record has `state`,
`district`, `market`, `commodity`, `variety`, `grade`, `arrival_date`
(`dd/mm/yyyy`) and numeric `min_price`, `max_price`, `modal_price`.
"""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from myfarm_api.core.config import get_settings


class FeedError(Exception):
    """The feed could not be read or returned something unusable."""


@dataclass(frozen=True)
class FeedRow:
    state: str
    district: str
    market: str
    commodity: str
    variety: str
    grade: str
    price_date: date
    min_price: Decimal
    max_price: Decimal
    modal_price: Decimal


def parse_record(record: dict[str, Any]) -> FeedRow | None:
    """A typed row, or None when the record is missing a name, date or price."""
    try:
        row = FeedRow(
            state=str(record["state"]).strip(),
            district=str(record["district"]).strip(),
            market=str(record["market"]).strip(),
            commodity=str(record["commodity"]).strip(),
            variety=str(record.get("variety") or "").strip(),
            grade=str(record.get("grade") or "").strip(),
            price_date=datetime.strptime(str(record["arrival_date"]).strip(), "%d/%m/%Y").date(),
            min_price=Decimal(str(record["min_price"])),
            max_price=Decimal(str(record["max_price"])),
            modal_price=Decimal(str(record["modal_price"])),
        )
    except (KeyError, ValueError, InvalidOperation):
        return None
    if not (row.district and row.market and row.commodity):
        return None
    if min(row.min_price, row.max_price, row.modal_price) < 0:
        return None
    return row


class MandiFeed:
    """Reads one commodity's rows for the configured state, page by page."""

    async def fetch_commodity(self, commodity: str) -> tuple[list[FeedRow], int]:
        """All rows for `commodity`, plus how many records were unusable."""
        settings = get_settings()
        if not settings.mandi_configured:
            raise FeedError("MANDI_API_KEY is not set")

        rows: list[FeedRow] = []
        skipped = 0
        offset = 0
        async with httpx.AsyncClient(timeout=settings.mandi_timeout_seconds) as client:
            while True:
                params = {
                    "api-key": settings.mandi_api_key,
                    "format": "json",
                    "offset": str(offset),
                    "limit": str(settings.mandi_page_size),
                    "filters[state.keyword]": settings.mandi_state,
                    "filters[commodity]": commodity,
                }
                try:
                    resp = await client.get(settings.mandi_api_url, params=params)
                    resp.raise_for_status()
                    body = resp.json()
                except (httpx.HTTPError, ValueError) as exc:
                    # Never echo the request URL: it carries the API key.
                    detail = f"feed request failed for {commodity}: {type(exc).__name__}"
                    raise FeedError(detail) from exc

                records = body.get("records")
                if not isinstance(records, list):
                    raise FeedError(f"feed reply for {commodity} has no records list")
                for record in records:
                    parsed = parse_record(record) if isinstance(record, dict) else None
                    if parsed is None:
                        skipped += 1
                    else:
                        rows.append(parsed)

                offset += len(records)
                total = body.get("total")
                if not records or not isinstance(total, int) or offset >= total:
                    break
        return rows, skipped


def get_mandi_feed() -> MandiFeed:
    return MandiFeed()
