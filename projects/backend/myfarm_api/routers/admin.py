"""Admin endpoints for database seeding and maintenance."""

import hmac
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import Select, func, select

from myfarm_api.core.config import get_settings
from myfarm_api.core.crop_seed import PREDEFINED_CROPS
from myfarm_api.core.db import get_session_factory
from myfarm_api.core.price_ingest import mapped_commodities, store_rows
from myfarm_api.models import ActivityType, CropCatalog, ExpenseCategory
from myfarm_api.schemas.mandi import PriceRowsIn


async def require_admin_token(x_admin_token: str | None = Header(default=None)) -> None:
    """Gate every admin route on the shared `X-Admin-Token` secret (#309).

    A blank `ADMIN_TOKEN` disables the admin endpoints (403) rather than
    leaving them open.
    """
    expected = get_settings().admin_token
    if not expected:
        raise HTTPException(status_code=403, detail="Admin endpoints are disabled")
    if x_admin_token is None or not hmac.compare_digest(x_admin_token, expected):
        raise HTTPException(status_code=401, detail="Invalid admin token")


router = APIRouter(
    prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_admin_token)]
)

# The expense-category and activity-type lists are load-bearing, not illustrative:
# the frontend maps a fixed free-text enum to one of these rows by exact name match
# (see ReferenceDataService) because Activity.type / ActivityExpense.category are
# plain string unions on the client, not FK ids. Every value must match its frontend
# source verbatim (activity.constants.ts's `ACTIVITY_TYPE_LABELS` keys and its
# `EXPENSE_CATEGORIES`). The crop list lives in core/crop_seed.py.
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
        # Seed crops: the predefined list (shared, no owner). Existing rows keep their id.
        crops_created = 0
        for seed in PREDEFINED_CROPS:
            stmt: Select[Any] = select(CropCatalog).where(
                func.lower(CropCatalog.name) == seed.name.lower(),
                CropCatalog.farmer_id.is_(None),
            )
            existing = (await session.execute(stmt)).scalars().first()
            if existing is None:
                session.add(
                    CropCatalog(
                        name=seed.name, category=seed.category, price_commodity=seed.commodity
                    )
                )
                crops_created += 1
            else:
                existing.category = seed.category
                if seed.commodity is not None:
                    existing.price_commodity = seed.commodity

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


@router.get("/prices/commodities")
async def price_commodities() -> dict[str, list[str]]:
    """The feed commodity names MyFarm crops map to: what the fetcher should ask for."""
    return {"commodities": await mapped_commodities()}


@router.post("/prices/rows")
async def intake_price_rows(data: PriceRowsIn) -> dict[str, int]:
    """Store a batch of mandi price rows fetched from the feed. Safe to send twice.

    The backend cannot call the feed itself (it refuses connections from outside
    India), so a fetcher running in India posts the raw records here.
    """
    return await store_rows(data.rows)
