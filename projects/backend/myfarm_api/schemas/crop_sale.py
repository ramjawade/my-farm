"""Pydantic schemas for crop sale endpoints."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from myfarm_api.schemas.common import NonNullUpdate

# Bounds mirror the Numeric(10, 2) and Numeric(12, 2) columns; a sale is always above zero.
PositiveDecimal10 = Annotated[Decimal, Field(gt=0, lt=Decimal(10) ** 8)]
PositiveDecimal12 = Annotated[Decimal, Field(gt=0, lt=Decimal(10) ** 10)]
Unit = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Buyer = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]


class CropSaleCreate(BaseModel):
    """Create a sale (crop_id is from the URL path)."""

    sold_on: date
    quantity: PositiveDecimal10
    unit: Unit
    rate: PositiveDecimal10
    amount: PositiveDecimal12
    buyer: Buyer | None = None
    notes: str | None = None


class CropSaleUpdate(NonNullUpdate):
    """Update sale fields."""

    non_null = ("sold_on", "quantity", "unit", "rate", "amount")

    sold_on: date | None = None
    quantity: PositiveDecimal10 | None = None
    unit: Unit | None = None
    rate: PositiveDecimal10 | None = None
    amount: PositiveDecimal12 | None = None
    buyer: Buyer | None = None
    notes: str | None = None


class CropSaleRead(BaseModel):
    """Read a sale record."""

    id: int
    crop_id: int
    sold_on: date
    quantity: Decimal
    unit: str
    rate: Decimal
    amount: Decimal
    buyer: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
