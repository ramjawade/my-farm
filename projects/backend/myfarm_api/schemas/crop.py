"""Pydantic schemas for crop endpoints."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class CropBase(BaseModel):
    """Shared crop fields."""

    land_id: UUID
    crop_catalog_id: UUID
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

    id: UUID | None = None


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

    id: UUID
    farmer_id: UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
