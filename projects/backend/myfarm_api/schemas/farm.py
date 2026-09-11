"""Pydantic schemas for farm endpoints."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class FarmBase(BaseModel):
    """Shared farm fields."""

    name: str = Field(..., max_length=255)
    area: Decimal | None = None
    area_unit: str = Field(default="sq_m", max_length=50)
    water_source: str | None = None
    irrigation_type: str | None = None
    farming_method: str | None = None
    location_type: str | None = None
    state: str | None = None
    district: str | None = None
    village: str | None = None
    pincode: str | None = None
    lat: Decimal | None = None
    lng: Decimal | None = None


class FarmCreate(FarmBase):
    """Create a farm."""


class FarmUpdate(BaseModel):
    """Update farm fields."""

    name: str | None = None
    area: Decimal | None = None
    area_unit: str | None = None
    water_source: str | None = None
    irrigation_type: str | None = None
    farming_method: str | None = None
    location_type: str | None = None
    state: str | None = None
    district: str | None = None
    village: str | None = None
    pincode: str | None = None
    lat: Decimal | None = None
    lng: Decimal | None = None


class FarmRead(FarmBase):
    """Read a farm record."""

    id: int
    farmer_id: int
    setup_completed: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
