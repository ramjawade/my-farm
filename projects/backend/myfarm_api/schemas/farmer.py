"""Pydantic schemas for farmer endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class FarmerBase(BaseModel):
    """Shared farmer fields."""

    full_name: str | None = Field(None, max_length=255)
    email: str | None = Field(None, max_length=255)
    preferred_language: str = Field(default="en", max_length=10)
    phone: str | None = Field(None, max_length=20)


class FarmerCreate(FarmerBase):
    """Create a farmer (JIT from auth token — no endpoint for manual creation)."""

    pass


class FarmerUpdate(BaseModel):
    """Update farmer profile fields."""

    full_name: str | None = Field(None, max_length=255)
    email: str | None = Field(None, max_length=255)
    preferred_language: str | None = Field(None, max_length=10)


class FarmerRead(FarmerBase):
    """Read a farmer record (current authenticated farmer)."""

    id: int
    auth_uid: str
    user_role: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
