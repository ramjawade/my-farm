"""Admin endpoints for database seeding and maintenance."""

from typing import Any

from fastapi import APIRouter
from sqlalchemy import Select, select

from myfarm_api.core.db import get_session_factory
from myfarm_api.models import ActivityType, CropCatalog, ExpenseCategory

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# These three lists are load-bearing, not illustrative: the frontend maps a
# fixed free-text enum to one of these rows by exact name match (see
# ReferenceDataService) because Activity.type / CropEntity.cropType /
# ActivityExpense.category are plain string unions on the client, not FK
# ids. Every value below must match its frontend source verbatim —
# crop-timeline.component.ts's `cropNameOptions`, activity.constants.ts's
# `ACTIVITY_TYPE_LABELS` keys, and its `EXPENSE_CATEGORIES` — or that
# activity/crop/expense fails to sync with "unknown crop/activity
# type/expense category".
SEED_CROPS = [
    "Soybeans",
    "Wheat",
    "Rice",
    "Corn",
    "Cotton",
    "Sugarcane",
    "Mustard",
    "Vegetables",
    "Fruits",
]

SEED_EXPENSE_CATEGORIES = [
    "Machine Rent",
    "Labour",
    "Seeds",
    "Fertilizer",
    "Pesticide",
    "Transport",
    "Fuel",
    "Equipment",
    "Water",
    "Other",
]

SEED_ACTIVITY_TYPES = [
    "Sowing",
    "Irrigation",
    "Fertilizer Application",
    "Spray Application",
    "Weeding",
    "Field Inspection",
    "Labour Activity",
    "Harvest",
    "Sale",
    "Weather Incident",
    "Maintenance",
    "Custom",
]


@router.post("/seed-reference-data")
async def seed_reference_data() -> dict[str, Any]:
    """Seed reference tables with initial data.

    Idempotent: skips records that already exist (by name).
    """
    session_factory = get_session_factory()

    async with session_factory() as session:
        # Seed crops
        crops_created = 0
        for crop_name in SEED_CROPS:
            stmt: Select[Any] = select(CropCatalog).where(CropCatalog.name == crop_name)
            result = await session.execute(stmt)
            if not result.scalar_one_or_none():
                crop = CropCatalog(name=crop_name)
                session.add(crop)
                crops_created += 1

        # Seed expense categories
        expenses_created = 0
        for expense_name in SEED_EXPENSE_CATEGORIES:
            stmt = select(ExpenseCategory).where(
                ExpenseCategory.name == expense_name
            )
            result = await session.execute(stmt)
            if not result.scalar_one_or_none():
                expense = ExpenseCategory(name=expense_name)
                session.add(expense)
                expenses_created += 1

        # Seed activity types
        activities_created = 0
        for activity_name in SEED_ACTIVITY_TYPES:
            stmt = select(ActivityType).where(ActivityType.name == activity_name)
            result = await session.execute(stmt)
            if not result.scalar_one_or_none():
                activity = ActivityType(name=activity_name)
                session.add(activity)
                activities_created += 1

        await session.commit()

    return {
        "crops_created": crops_created,
        "expenses_created": expenses_created,
        "activities_created": activities_created,
        "total_created": crops_created + expenses_created + activities_created,
        "message": "Reference data seeding complete",
    }
