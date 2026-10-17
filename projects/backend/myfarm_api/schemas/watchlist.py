"""Pydantic schemas for watchlist endpoints."""

from datetime import date
from typing import Annotated

from pydantic import BaseModel, StringConstraints

from myfarm_api.schemas.common import BodyId
from myfarm_api.schemas.mandi import MandiRead

ListName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]


class WatchlistCreate(BaseModel):
    """Create a watchlist."""

    name: ListName


class WatchlistItemCreate(BaseModel):
    """Add a crop at a market to a watchlist."""

    crop_catalog_id: BodyId
    mandi_id: BodyId


class WatchlistItemRead(BaseModel):
    """One item with its latest price; the price is null when the market has none."""

    id: int
    crop_catalog_id: int
    commodity: str
    mandi: MandiRead
    price: float | None = None
    price_date: date | None = None
    previous_price: float | None = None
    change_pct: float | None = None


class WatchlistRead(BaseModel):
    id: int
    name: str
    items: list[WatchlistItemRead]


class Watchlists(BaseModel):
    lists: list[WatchlistRead]
