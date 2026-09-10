"""Pydantic schemas for activity attachment endpoints."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ActivityAttachmentBase(BaseModel):
    """Shared activity attachment fields."""

    activity_id: UUID
    storage_key: str
    content_type: str | None = None
    size_bytes: int | None = None


class ActivityAttachmentCreate(BaseModel):
    """Create an activity attachment (activity_id is from URL path)."""

    storage_key: str
    content_type: str | None = None
    size_bytes: int | None = None


class ActivityAttachmentRead(ActivityAttachmentBase):
    """Read an activity attachment record."""

    id: UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True


class ActivityAttachmentUploadRequest(BaseModel):
    """Request a presigned upload URL for an attachment."""

    filename: str
    content_type: str = "application/octet-stream"


class ActivityAttachmentUploadResponse(BaseModel):
    """Response with presigned upload URL."""

    upload_url: str
    storage_key: str
    expires_in: int
