"""Admin endpoints for database seeding and maintenance."""

from uuid import uuid4

from fastapi import APIRouter
from sqlalchemy import select

from myfarm_api.core.db import get_session_factory
from myfarm_api.models import ActivityType, CropCatalog, ExpenseCategory

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

SEED_CROPS = [
    "Rice",
    "Wheat",
    "Corn",
    "Sugarcane",
    "Cotton",
    "Potato",
    "Onion",
    "Tomato",
    "Groundnut",
    "Soybean",
    "Maize",
    "Barley",
    "Sorghum",
    "Pearl Millet",
    "Mustard",
    "Linseed",
    "Sesame",
    "Sunflower",
    "Safflower",
    "Chickpea",
    "Lentil",
    "Green Gram",
    "Black Gram",
    "Pea",
    "Bean",
]

SEED_EXPENSE_CATEGORIES = [
    "Seeds",
    "Fertilizers",
    "Pesticides",
    "Labor",
    "Fuel",
    "Water",
    "Equipment Rent",
    "Transportation",
    "Storage",
    "Insurance",
    "Land Lease",
]

SEED_ACTIVITY_TYPES = [
    "Sowing",
    "Irrigation",
    "Weeding",
    "Pesticide Application",
    "Fertilizer Application",
    "Pruning",
    "Harvesting",
    "Threshing",
    "Drying",
    "Stacking",
    "Land Preparation",
    "Mulching",
    "Transplanting",
    "De-flowering",
    "Manual Spraying",
]


@router.post("/seed-reference-data")
async def seed_reference_data() -> dict:
    """Seed reference tables with initial data.

    Idempotent: skips records that already exist (by name).
    """
    session_factory = get_session_factory()

    async with session_factory() as session:
        # Seed crops
        crops_created = 0
        for crop_name in SEED_CROPS:
            stmt = select(CropCatalog).where(CropCatalog.name == crop_name)
            result = await session.execute(stmt)
            if not result.scalar_one_or_none():
                crop = CropCatalog(id=uuid4(), name=crop_name)
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
                expense = ExpenseCategory(id=uuid4(), name=expense_name)
                session.add(expense)
                expenses_created += 1

        # Seed activity types
        activities_created = 0
        for activity_name in SEED_ACTIVITY_TYPES:
            stmt = select(ActivityType).where(ActivityType.name == activity_name)
            result = await session.execute(stmt)
            if not result.scalar_one_or_none():
                activity = ActivityType(id=uuid4(), name=activity_name)
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
