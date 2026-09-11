"""Pydantic schemas for reference data endpoints."""

from uuid import UUID

from pydantic import BaseModel, Field


class CropCatalogCreate(BaseModel):
    """Create a new crop catalog entry."""

    name: str = Field(..., min_length=1)


class CropCatalogRead(BaseModel):
    """Read a crop catalog record."""

    id: UUID
    name: str
    common_names: str | None = None

    class Config:
        from_attributes = True


class ExpenseCategoryRead(BaseModel):
    """Read an expense category record."""

    id: int
    name: str

    class Config:
        from_attributes = True


class ActivityTypeRead(BaseModel):
    """Read an activity type record."""

    id: int
    name: str

    class Config:
        from_attributes = True


class SeasonRead(BaseModel):
    """Read a season record."""

    id: int
    name: str

    class Config:
        from_attributes = True


class CropStageRead(BaseModel):
    """Read a crop stage record."""

    id: int
    name: str

    class Config:
        from_attributes = True
