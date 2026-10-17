"""Pydantic schemas for reference data endpoints."""

from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from myfarm_api.core.crop_seed import MAX_CROP_NAME_LENGTH

CropName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_CROP_NAME_LENGTH),
]


class CropCatalogCreate(BaseModel):
    """Add a crop by name: a predefined crop, the farmer's own, or a new custom crop."""

    name: CropName


class CropCatalogRead(BaseModel):
    """Read a crop catalog record."""

    id: int
    name: str
    common_names: str | None = None
    category: str | None = None
    # True for a crop the signed-in farmer added; false for the predefined list.
    custom: bool = False
    # True when the crop has a mandi price, so it can be watched on the Prices page.
    has_price: bool = False

    class Config:
        from_attributes = True


class ExpenseCategoryRead(BaseModel):
    """Read an expense category record."""

    id: int
    name: str

    class Config:
        from_attributes = True


class ActivityTypeCreate(BaseModel):
    """Create a new activity type."""

    name: str = Field(..., min_length=1)


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
