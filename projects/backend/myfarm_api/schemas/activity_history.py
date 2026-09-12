"""Pydantic schemas for the activity history/audit-trail endpoint."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ActivityHistoryRead(BaseModel):
    """Read a single activity history entry."""

    id: int
    activity_id: int
    event_type: str
    detail: dict[str, Any] | None = None
    created_at: datetime

    class Config:
        from_attributes = True
