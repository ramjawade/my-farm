"""Pydantic schemas for activity endpoints."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


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


class ActivityUpdate(BaseModel):
    """Update activity fields."""

    activity_type_id: int | None = None
    crop_id: int | None = None
    land_id: int | None = None
    parent_activity_id: int | None = None
    custom_activity_name: str | None = None
    date: str | None = None
    season: str | None = None
    status: str | None = None
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
