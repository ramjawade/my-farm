"""Parsing of records from the data.gov.in mandi price feed (Agmarknet, daily prices).

The backend never calls the feed: it refuses connections from outside India, so
`scripts/fetch-mandi-prices.mjs` fetches from an Indian IP and posts the raw records
to the admin intake endpoint. Each record has `state`, `district`, `market`,
`commodity`, `variety`, `grade`, `arrival_date` (`dd/mm/yyyy`) and numeric
`min_price`, `max_price`, `modal_price`.
"""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any


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
    prices = (row.min_price, row.max_price, row.modal_price)
    # Numeric(10, 2) holds below 10^8; a NaN or huge value would fail the whole batch.
    if any(not p.is_finite() or p < 0 or p >= Decimal(10) ** 8 for p in prices):
        return None
    return row
