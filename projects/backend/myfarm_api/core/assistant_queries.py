"""Fixed per-topic queries behind the farmer assistant (#287).

The assistant never lets a model write a query. A model may only *pick a
topic* from the closed set below and name a crop, land or period; everything
that touches the database is a function in this module, so every figure in an
answer traces back to one of them.

Two rules run through all of it, both inherited from ``entry_resolver``:

* **Only the asking farmer's rows.** Every query filters on ``farmer_id`` and
  ``deleted_at IS NULL``. Postgres RLS does not apply on Neon's hosted roles
  (BACKEND_PLAN.md §11), so these WHERE clauses are the tenant boundary.
* **Never a nearest match.** A name that matches nothing, or matches rows of
  different crops, is reported as such so the bot can ask — it is never
  resolved to a best guess.

Name matching and weather shaping are pure functions (no database, no
network) so they can be tested exhaustively; the ``async`` functions are thin
SQL around them.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Literal

from sqlalchemy import ColumnElement, func, or_, select

from myfarm_api.core.db import get_session_factory
from myfarm_api.core.entry_resolver import normalize
from myfarm_api.core.weather import get_weather
from myfarm_api.models import (
    Activity,
    ActivityExpense,
    ActivityType,
    Crop,
    CropCatalog,
    ExpenseCategory,
    Land,
    LandPoint,
)

logger = logging.getLogger(__name__)

# Same set `GET /activities/summary` counts as "in progress".
PENDING_STATUSES = ("Scheduled", "Draft", "In Progress")

Period = Literal[
    "all",
    "today",
    "last_7_days",
    "last_30_days",
    "this_week",
    "this_month",
    "last_month",
    "this_year",
]


# ------------------------------------------------------------------ periods


def period_bounds(period: Period, today: date) -> tuple[str | None, str | None]:
    """Inclusive ``(start, end)`` ISO dates for a named period.

    ``Activity.date`` is an ISO ``YYYY-MM-DD`` string, so string comparison
    orders correctly. ``all`` is unbounded on both sides.
    """
    if period == "all":
        return None, None
    if period == "today":
        return today.isoformat(), today.isoformat()
    if period == "last_7_days":
        return (today - timedelta(days=6)).isoformat(), today.isoformat()
    if period == "last_30_days":
        return (today - timedelta(days=29)).isoformat(), today.isoformat()
    if period == "this_week":
        monday = today - timedelta(days=today.weekday())
        return monday.isoformat(), today.isoformat()
    if period == "this_month":
        return today.replace(day=1).isoformat(), today.isoformat()
    if period == "last_month":
        first_this = today.replace(day=1)
        last_prev = first_this - timedelta(days=1)
        return last_prev.replace(day=1).isoformat(), last_prev.isoformat()
    # this_year
    return today.replace(month=1, day=1).isoformat(), today.isoformat()


@dataclass(frozen=True)
class Scope:
    """What an activity/expense question is about. Empty means "everything"."""

    crop_ids: tuple[int, ...] = ()
    land_id: int | None = None
    start: str | None = None
    end: str | None = None


def _activity_conditions(farmer_id: int, scope: Scope) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = [
        Activity.farmer_id == farmer_id,
        Activity.deleted_at.is_(None),
    ]
    if scope.crop_ids:
        conditions.append(Activity.crop_id.in_(scope.crop_ids))
    if scope.land_id is not None:
        # An activity can carry only a crop, so a land also covers the crops
        # planted on it — otherwise "spend on Plot 2" would miss those rows.
        on_land = select(Crop.id).where(
            Crop.land_id == scope.land_id,
            Crop.farmer_id == farmer_id,
            Crop.deleted_at.is_(None),
        )
        conditions.append(or_(Activity.land_id == scope.land_id, Activity.crop_id.in_(on_land)))
    if scope.start is not None:
        conditions.append(Activity.date >= scope.start)
    if scope.end is not None:
        conditions.append(Activity.date <= scope.end)
    return conditions


# ------------------------------------------------------------------ spend


async def spend(farmer_id: int, scope: Scope) -> dict[str, Any]:
    """Total expense in scope. Same rules as ``GET /activities/summary``.

    ``expense_count`` lets the caller say "nothing recorded" instead of
    presenting a zero total as a fact about the farm's costs.
    """
    stmt = (
        select(
            func.coalesce(func.sum(ActivityExpense.amount), 0),
            func.count(ActivityExpense.amount),
        )
        .select_from(ActivityExpense)
        .join(Activity, ActivityExpense.activity_id == Activity.id)
        .where(*_activity_conditions(farmer_id, scope), ActivityExpense.deleted_at.is_(None))
    )
    async with get_session_factory()() as session:
        total, count = (await session.execute(stmt)).one()
    return {"total": float(total or 0), "expense_count": int(count)}


async def spend_by_category(farmer_id: int, scope: Scope) -> list[dict[str, Any]]:
    """Expense totals per category in scope, largest first."""
    total = func.coalesce(func.sum(ActivityExpense.amount), 0)
    stmt = (
        select(ExpenseCategory.name, total)
        .select_from(ActivityExpense)
        .join(Activity, ActivityExpense.activity_id == Activity.id)
        .join(ExpenseCategory, ActivityExpense.expense_category_id == ExpenseCategory.id)
        .where(*_activity_conditions(farmer_id, scope), ActivityExpense.deleted_at.is_(None))
        .group_by(ExpenseCategory.name)
        .order_by(total.desc(), ExpenseCategory.name)
    )
    async with get_session_factory()() as session:
        rows = (await session.execute(stmt)).all()
    return [{"category": name, "total": float(amount or 0)} for name, amount in rows]


# -------------------------------------------------------------- activities


async def _activities(
    farmer_id: int,
    scope: Scope,
    *,
    statuses: Sequence[str] | None,
    newest_first: bool,
    limit: int,
) -> list[dict[str, Any]]:
    stmt = (
        select(
            Activity.id,
            Activity.custom_activity_name,
            ActivityType.name,
            Activity.date,
            Activity.status,
            Land.name,
            Crop.label,
            CropCatalog.name,
        )
        .join(ActivityType, Activity.activity_type_id == ActivityType.id)
        .outerjoin(Land, Activity.land_id == Land.id)
        .outerjoin(Crop, Activity.crop_id == Crop.id)
        .outerjoin(CropCatalog, Crop.crop_catalog_id == CropCatalog.id)
        .where(*_activity_conditions(farmer_id, scope))
    )
    if statuses is not None:
        stmt = stmt.where(Activity.status.in_(statuses))
    if newest_first:
        stmt = stmt.order_by(Activity.date.desc().nulls_last(), Activity.id.desc())
    else:
        stmt = stmt.order_by(Activity.date.asc().nulls_last(), Activity.id.asc())

    async with get_session_factory()() as session:
        rows = (await session.execute(stmt.limit(limit))).all()
    return [
        {
            "id": row_id,
            "activity": custom_name or type_name,
            "date": day,
            "status": status,
            "land": land_name,
            "crop": crop_label or catalog_name,
        }
        for row_id, custom_name, type_name, day, status, land_name, crop_label, catalog_name in rows
    ]


async def recent_activities(farmer_id: int, scope: Scope, limit: int = 5) -> list[dict[str, Any]]:
    """Most recent activities in scope, newest first (undated ones last)."""
    return await _activities(farmer_id, scope, statuses=None, newest_first=True, limit=limit)


async def pending_activities(farmer_id: int, scope: Scope, limit: int = 10) -> list[dict[str, Any]]:
    """Scheduled / Draft / In Progress activities, soonest first (undated last)."""
    return await _activities(
        farmer_id, scope, statuses=PENDING_STATUSES, newest_first=False, limit=limit
    )


async def pending_count(farmer_id: int, scope: Scope) -> int:
    """How many pending activities there are in total (the list is capped)."""
    stmt = (
        select(func.count())
        .select_from(Activity)
        .where(*_activity_conditions(farmer_id, scope), Activity.status.in_(PENDING_STATUSES))
    )
    async with get_session_factory()() as session:
        return int((await session.execute(stmt)).scalar_one())


async def has_any_data(farmer_id: int) -> bool:
    """Whether the farmer has recorded any land or activity at all."""
    async with get_session_factory()() as session:
        land = await session.execute(
            select(Land.id).where(Land.farmer_id == farmer_id, Land.deleted_at.is_(None)).limit(1)
        )
        if land.first() is not None:
            return True
        activity = await session.execute(
            select(Activity.id)
            .where(Activity.farmer_id == farmer_id, Activity.deleted_at.is_(None))
            .limit(1)
        )
        return activity.first() is not None


# ------------------------------------------------------------ lands, crops


def crop_display_name(label: str | None, catalog_name: str) -> str:
    return label or catalog_name


async def lands(farmer_id: int) -> list[dict[str, Any]]:
    """The farmer's lands, each with the names of the crops planted on it."""
    async with get_session_factory()() as session:
        land_rows = (
            await session.execute(
                select(Land.id, Land.name, Land.area_sq_m)
                .where(Land.farmer_id == farmer_id, Land.deleted_at.is_(None))
                .order_by(Land.id)
            )
        ).all()
        crop_rows = (
            await session.execute(
                select(Crop.land_id, Crop.label, CropCatalog.name)
                .join(CropCatalog, Crop.crop_catalog_id == CropCatalog.id)
                .where(Crop.farmer_id == farmer_id, Crop.deleted_at.is_(None))
                .order_by(Crop.id)
            )
        ).all()

    crops_by_land: dict[int, list[str]] = {}
    for land_id, label, catalog_name in crop_rows:
        crops_by_land.setdefault(land_id, []).append(crop_display_name(label, catalog_name))
    return [
        {
            "id": land_id,
            "name": name,
            "area_sq_m": float(area) if area is not None else None,
            "crops": crops_by_land.get(land_id, []),
        }
        for land_id, name, area in land_rows
    ]


async def crops(farmer_id: int) -> list[dict[str, Any]]:
    """The farmer's crops with the land each is planted on."""
    stmt = (
        select(
            Crop.id,
            Crop.label,
            CropCatalog.name,
            Land.name,
            Crop.status,
            Crop.season,
            Crop.current_stage,
        )
        .join(CropCatalog, Crop.crop_catalog_id == CropCatalog.id)
        .join(Land, Crop.land_id == Land.id)
        .where(Crop.farmer_id == farmer_id, Crop.deleted_at.is_(None))
        .order_by(Crop.id)
    )
    async with get_session_factory()() as session:
        rows = (await session.execute(stmt)).all()
    return [
        {
            "id": crop_id,
            "name": crop_display_name(label, catalog_name),
            "land": land_name,
            "status": status,
            "season": season,
            "stage": stage,
        }
        for crop_id, label, catalog_name, land_name, status, season, stage in rows
    ]


# -------------------------------------------------------- name resolution


@dataclass(frozen=True)
class CropName:
    id: int
    name: str
    catalog_id: int
    # Every normalised spelling the farmer might use: their label, the
    # catalogue name, and its vernacular aliases ("kapas" for Cotton).
    keys: frozenset[str]


@dataclass(frozen=True)
class FarmerNames:
    """The farmer's own lands and crops, for resolving names in a question."""

    lands: tuple[tuple[int, str], ...] = ()
    crops: tuple[CropName, ...] = ()


@dataclass(frozen=True)
class NameMatch:
    """Outcome of resolving one spoken name.

    ``options`` are the farmer's real names, offered as quick replies when the
    name was unknown or ambiguous. Empty when matched.
    """

    kind: Literal["matched", "ambiguous", "unknown"]
    ids: tuple[int, ...] = ()
    options: tuple[str, ...] = field(default=())


def _distinct(names: Sequence[str]) -> tuple[str, ...]:
    return tuple(sorted(set(names), key=str.casefold))


def match_land(names: FarmerNames, word: str) -> NameMatch:
    """Resolve a land name. Two lands with the same name are ambiguous."""
    key = normalize(word)
    hits = [(land_id, name) for land_id, name in names.lands if normalize(name) == key]
    if len(hits) == 1:
        return NameMatch("matched", (hits[0][0],))
    everyone = _distinct([name for _, name in names.lands])
    if hits:
        return NameMatch("ambiguous", options=_distinct([name for _, name in hits]))
    return NameMatch("unknown", options=everyone)


def match_crops(names: FarmerNames, word: str) -> NameMatch:
    """Resolve a crop name to every planting of that crop.

    "Wheat" on two plots is one crop asked about twice, so those rows are
    aggregated. A name that reaches rows of *different* catalogue crops (a
    label shared with another species, say) is ambiguous.
    """
    key = normalize(word)
    hits = [c for c in names.crops if key in c.keys]
    if hits and len({c.catalog_id for c in hits}) == 1:
        return NameMatch("matched", tuple(c.id for c in hits))
    if hits:
        return NameMatch("ambiguous", options=_distinct([c.name for c in hits]))
    return NameMatch("unknown", options=_distinct([c.name for c in names.crops]))


async def load_names(farmer_id: int) -> FarmerNames:
    """One read of this farmer's lands and crops for name resolution."""
    async with get_session_factory()() as session:
        land_rows = (
            await session.execute(
                select(Land.id, Land.name).where(
                    Land.farmer_id == farmer_id, Land.deleted_at.is_(None)
                )
            )
        ).all()
        crop_rows = (
            await session.execute(
                select(
                    Crop.id,
                    Crop.label,
                    Crop.crop_catalog_id,
                    CropCatalog.name,
                    CropCatalog.common_names,
                )
                .join(CropCatalog, Crop.crop_catalog_id == CropCatalog.id)
                .where(Crop.farmer_id == farmer_id, Crop.deleted_at.is_(None))
            )
        ).all()

    crop_names: list[CropName] = []
    for crop_id, label, catalog_id, catalog_name, common_names in crop_rows:
        spellings = [label, catalog_name, *(a.strip() for a in (common_names or "").split(","))]
        keys = frozenset(k for s in spellings if s and (k := normalize(s)))
        crop_names.append(
            CropName(crop_id, crop_display_name(label, catalog_name), catalog_id, keys)
        )
    return FarmerNames(
        lands=tuple((land_id, name) for land_id, name in land_rows),
        crops=tuple(crop_names),
    )


# ---------------------------------------------------------------- weather


@dataclass(frozen=True)
class LandLocation:
    id: int
    name: str
    lat: float
    lng: float


def centroid(points: Sequence[tuple[float, float]]) -> tuple[float, float]:
    """Mean of a land's boundary vertices — close enough for a 1° weather grid."""
    lats, lngs = zip(*points, strict=True)
    return sum(lats) / len(lats), sum(lngs) / len(lngs)


def weather_facts(payload: dict[str, Any], source: str) -> dict[str, Any]:
    """Boil an OpenWeatherMap payload down to the few facts an answer needs."""
    main = payload.get("main") or {}
    wind = payload.get("wind") or {}
    conditions = payload.get("weather") or [{}]
    rain = payload.get("rain") or {}
    return {
        "temp_c": main.get("temp"),
        "feels_like_c": main.get("feels_like"),
        "humidity_pct": main.get("humidity"),
        "description": conditions[0].get("description"),
        "wind_ms": wind.get("speed"),
        "rain_mm_1h": rain.get("1h"),
        # 'mock' means no live data — the answer should not present it as real.
        "source": source,
    }


async def land_locations(farmer_id: int) -> list[LandLocation]:
    """Lands that have boundary points, with their centroid."""
    stmt = (
        select(Land.id, Land.name, LandPoint.lat, LandPoint.lng)
        .join(LandPoint, LandPoint.land_id == Land.id)
        .where(Land.farmer_id == farmer_id, Land.deleted_at.is_(None))
        .order_by(Land.id, LandPoint.seq)
    )
    async with get_session_factory()() as session:
        rows = (await session.execute(stmt)).all()

    grouped: dict[int, tuple[str, list[tuple[float, float]]]] = {}
    for land_id, name, lat, lng in rows:
        grouped.setdefault(land_id, (name, []))[1].append((float(lat), float(lng)))
    result = []
    for land_id, (name, points) in grouped.items():
        lat, lng = centroid(points)
        result.append(LandLocation(land_id, name, lat, lng))
    return result


@dataclass(frozen=True)
class WeatherResult:
    """Weather for one land, or the reason there is none."""

    status: Literal["ok", "no_location", "ambiguous", "unavailable"]
    land: str | None = None
    facts: dict[str, Any] | None = None
    options: tuple[str, ...] = field(default=())


async def weather_for_land(
    farmer_id: int, land_id: int | None, *, first_land: bool = False
) -> WeatherResult:
    """Current weather for the named land, or for the farmer's only located land.

    ``land_id`` must already have been resolved against this farmer's lands.
    With ``first_land`` a farmer with several located lands gets the first one
    instead of an ambiguity — right for a greeting, wrong for a question.
    """
    locations = await land_locations(farmer_id)

    if land_id is not None:
        chosen = next((loc for loc in locations if loc.id == land_id), None)
    elif len(locations) == 1 or (first_land and locations):
        chosen = locations[0]
    elif locations:
        return WeatherResult("ambiguous", options=_distinct([loc.name for loc in locations]))
    else:
        chosen = None

    if chosen is None:
        return WeatherResult("no_location")

    try:
        weather = await get_weather(chosen.lat, chosen.lng)
    except Exception:  # any provider failure just means "no weather"
        logger.warning("assistant weather lookup failed", exc_info=True)
        return WeatherResult("unavailable", land=chosen.name)
    return WeatherResult(
        "ok",
        land=chosen.name,
        facts=weather_facts(weather.get("data") or {}, str(weather.get("source"))),
    )
