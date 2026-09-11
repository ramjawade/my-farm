"""Pydantic schemas for activity expense endpoints."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class ActivityExpenseBase(BaseModel):
    """Shared activity expense fields."""

    activity_id: int
    expense_category_id: int
    item_id: str | None = None
    resource_id: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    rate: Decimal | None = None
    amount: Decimal | None = None
    remarks: str | None = None


class ActivityExpenseCreate(BaseModel):
    """Create an activity expense (activity_id is from URL path)."""

    expense_category_id: int
    item_id: str | None = None
    resource_id: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    rate: Decimal | None = None
    amount: Decimal | None = None
    remarks: str | None = None


class ActivityExpenseUpdate(BaseModel):
    """Update activity expense fields."""

    expense_category_id: int | None = None
    item_id: str | None = None
    resource_id: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    rate: Decimal | None = None
    amount: Decimal | None = None
    remarks: str | None = None


class ActivityExpenseRead(ActivityExpenseBase):
    """Read an activity expense record."""

    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
