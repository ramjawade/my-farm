"""Pydantic schemas for mandi and price endpoints."""

from datetime import date
from typing import Any

from pydantic import BaseModel, Field

from myfarm_api.schemas.common import BodyId


class PriceRowsIn(BaseModel):
    """A batch of raw mandi feed records; bad rows are skipped, not fatal."""

    rows: list[dict[str, Any]] = Field(max_length=5000)


class MandiRead(BaseModel):
    """A market as farmers see it: name and district."""

    id: int
    name: str
    district: str

    class Config:
        from_attributes = True


class MyMandisRead(BaseModel):
    """The farmer's followed mandis; `suggested` is true while they are the defaults."""

    items: list[MandiRead]
    suggested: bool


class MyMandisUpdate(BaseModel):
    """Replace the followed mandis: one to five distinct ids, in the order chosen."""

    mandi_ids: list[BodyId] = Field(min_length=1, max_length=5)


class MandiPrice(BaseModel):
    """A commodity's price at one mandi on its latest reading, per quintal."""

    mandi: MandiRead
    price: float | None = None
    price_date: date | None = None
    previous_price: float | None = None
    change_pct: float | None = None


class CropPrices(BaseModel):
    """The prices of one crop at each followed mandi."""

    crop_id: int
    crop_catalog_id: int
    commodity: str | None = None
    mandis: list[MandiPrice]


class LatestPrices(BaseModel):
    crops: list[CropPrices]


class PricePoint(BaseModel):
    date: date
    price: float


class PriceHistory(BaseModel):
    """A commodity's daily modal price at one mandi, oldest first, with the period's extremes."""

    mandi: MandiRead
    commodity: str
    days: int
    points: list[PricePoint]
    lowest: float | None = None
    average: float | None = None
    highest: float | None = None
