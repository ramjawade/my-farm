"""Pydantic schemas for activity endpoints."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from myfarm_api.schemas.common import BodyId, IsoDate, NonNullUpdate


class ActivityBase(BaseModel):
    """Shared activity fields."""

    activity_type_id: int
    crop_id: int | None = None
    land_id: int | None = None
    parent_activity_id: int | None = None
    custom_activity_name: str | None = None
    date: str | None = None
    season: str | None = None
    status: str = Field(default="pending", max_length=50)
    notes: str | None = None
    activity_meta: dict[str, Any] | None = None


class ActivityCreate(ActivityBase):
    """Create an activity."""

    activity_type_id: BodyId
    crop_id: BodyId | None = None
    land_id: BodyId | None = None
    parent_activity_id: BodyId | None = None
    date: IsoDate | None = None


class ActivityUpdate(NonNullUpdate):
    """Update activity fields."""

    non_null = ("activity_type_id", "status")

    activity_type_id: BodyId | None = None
    crop_id: BodyId | None = None
    land_id: BodyId | None = None
    parent_activity_id: BodyId | None = None
    custom_activity_name: str | None = None
    date: IsoDate | None = None
    season: str | None = None
    status: str | None = Field(None, max_length=50)
    notes: str | None = None
    activity_meta: dict[str, Any] | None = None


class ActivityRead(ActivityBase):
    """Read an activity record."""

    id: int
    farmer_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True


class ActivitySummaryRead(BaseModel):
    """KPI counts + total expense for GET /activities/summary."""

    total: int
    completed: int
    in_progress: int
    total_expense: float


class ActivityDetailSummaryRead(BaseModel):
    """KPI summary for a single activity — GET /activities/{id}/summary."""

    total_expense: float
    expense_count: int
    days_since_created: int
    status: str
