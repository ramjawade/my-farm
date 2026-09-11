"""Pydantic schemas for land endpoints."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class LandPoint(BaseModel):
    """A GPS coordinate polygon vertex."""

    lat: Decimal
    lng: Decimal


class LandBase(BaseModel):
    """Shared land fields."""

    name: str = Field(..., max_length=255)
    farm_id: int
    area_sq_m: Decimal | None = None
    notes: str | None = None
    points: list[LandPoint] | None = None


class LandCreate(LandBase):
    """Create a land."""


class LandUpdate(BaseModel):
    """Update land fields."""

    name: str | None = None
    area_sq_m: Decimal | None = None
    notes: str | None = None
    points: list[LandPoint] | None = None


class LandRead(LandBase):
    """Read a land record."""

    id: int
    farmer_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
