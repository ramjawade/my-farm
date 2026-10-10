"""Pydantic schemas for farm endpoints."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from myfarm_api.schemas.common import BodyId, Decimal10, Latitude, Longitude, Name, NonNullUpdate


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

    name: Name
    area: Decimal10 | None = None
    lat: Latitude | None = None
    lng: Longitude | None = None


class FarmUpdate(NonNullUpdate):
    """Update farm fields."""

    non_null = ("name", "area_unit", "setup_completed", "crop_catalog_ids")

    name: Name | None = None
    area: Decimal10 | None = None
    area_unit: str | None = Field(None, max_length=50)
    water_source: str | None = None
    irrigation_type: str | None = None
    farming_method: str | None = None
    location_type: str | None = None
    state: str | None = None
    district: str | None = None
    village: str | None = None
    pincode: str | None = None
    lat: Latitude | None = None
    lng: Longitude | None = None
    setup_completed: bool | None = None
    crop_catalog_ids: list[BodyId] | None = None


class FarmRead(FarmBase):
    """Read a farm record."""

    id: int
    farmer_id: int
    setup_completed: bool
    crop_catalog_ids: list[int] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
