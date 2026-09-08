"""Pydantic schemas for reference data endpoints."""

from uuid import UUID

from pydantic import BaseModel


class CropCatalogRead(BaseModel):
    """Read a crop catalog record."""

    id: UUID
    name: str
    common_names: str | None = None

    class Config:
        from_attributes = True


class ExpenseCategoryRead(BaseModel):
    """Read an expense category record."""

    id: UUID
    name: str

    class Config:
        from_attributes = True


class ActivityTypeRead(BaseModel):
    """Read an activity type record."""

    id: UUID
    name: str

    class Config:
        from_attributes = True
