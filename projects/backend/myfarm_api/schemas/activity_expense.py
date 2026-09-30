"""Pydantic schemas for activity expense endpoints."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from myfarm_api.schemas.common import BodyId, Decimal10, Decimal12, NonNullUpdate


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

    expense_category_id: BodyId
    item_id: str | None = None
    resource_id: str | None = None
    quantity: Decimal10 | None = None
    unit: str | None = None
    rate: Decimal10 | None = None
    amount: Decimal12 | None = None
    remarks: str | None = None


class ActivityExpenseUpdate(NonNullUpdate):
    """Update activity expense fields."""

    non_null = ("expense_category_id",)

    expense_category_id: BodyId | None = None
    item_id: str | None = None
    resource_id: str | None = None
    quantity: Decimal10 | None = None
    unit: str | None = None
    rate: Decimal10 | None = None
    amount: Decimal12 | None = None
    remarks: str | None = None


class ActivityExpenseRead(ActivityExpenseBase):
    """Read an activity expense record."""

    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
