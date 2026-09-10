"""Pydantic schemas for activity expense endpoints."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ActivityExpenseBase(BaseModel):
    """Shared activity expense fields."""

    activity_id: UUID
    expense_category_id: UUID
    item_id: str | None = None
    resource_id: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    rate: Decimal | None = None
    amount: Decimal | None = None
    remarks: str | None = None


class ActivityExpenseCreate(BaseModel):
    """Create an activity expense (activity_id is from URL path)."""

    expense_category_id: UUID
    item_id: str | None = None
    resource_id: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    rate: Decimal | None = None
    amount: Decimal | None = None
    remarks: str | None = None
    id: UUID | None = None


class ActivityExpenseUpdate(BaseModel):
    """Update activity expense fields."""

    expense_category_id: UUID | None = None
    item_id: str | None = None
    resource_id: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    rate: Decimal | None = None
    amount: Decimal | None = None
    remarks: str | None = None


class ActivityExpenseRead(ActivityExpenseBase):
    """Read an activity expense record."""

    id: UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
