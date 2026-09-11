"""Pydantic schemas for crop endpoints."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class CropBase(BaseModel):
    """Shared crop fields."""

    land_id: int
    crop_catalog_id: int
    label: str | None = None
    area: Decimal | None = None
    area_unit: str = Field(default="sq_m", max_length=50)
    season: str | None = None
    sowing_date: str | None = None
    current_stage: str | None = None
    status: str = Field(default="active", max_length=50)
    expected_harvest_date: str | None = None


class CropCreate(CropBase):
    """Create a crop."""


class CropUpdate(BaseModel):
    """Update crop fields."""

    label: str | None = None
    area: Decimal | None = None
    area_unit: str | None = None
    season: str | None = None
    sowing_date: str | None = None
    current_stage: str | None = None
    status: str | None = None
    expected_harvest_date: str | None = None


class CropRead(CropBase):
    """Read a crop record."""

    id: int
    farmer_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
