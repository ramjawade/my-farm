"""Pydantic schemas for land endpoints."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from myfarm_api.schemas.common import (
    BodyId,
    Decimal12,
    Latitude,
    Longitude,
    Name,
    NonNullUpdate,
)


class LandPoint(BaseModel):
    """A GPS coordinate polygon vertex."""

    model_config = ConfigDict(from_attributes=True)

    lat: Decimal
    lng: Decimal


class LandBase(BaseModel):
    """Shared land fields."""

    name: str = Field(..., max_length=255)
    farm_id: int
    area_sq_m: Decimal | None = None
    notes: str | None = None
    points: list[LandPoint] | None = None


class LandPointInput(BaseModel):
    """A polygon vertex as submitted by a client (range-checked)."""

    lat: Latitude
    lng: Longitude


class LandCreate(LandBase):
    """Create a land."""

    name: Name
    farm_id: BodyId
    area_sq_m: Decimal12 | None = None
    # Invariant list override of LandBase's read-side type, hence the ignore.
    points: list[LandPointInput] | None = None  # type: ignore[assignment]


class LandUpdate(NonNullUpdate):
    """Update land fields."""

    non_null = ("name",)

    name: Name | None = None
    area_sq_m: Decimal12 | None = None
    notes: str | None = None
    points: list[LandPointInput] | None = None


class LandRead(LandBase):
    """Read a land record."""

    id: int
    farmer_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
