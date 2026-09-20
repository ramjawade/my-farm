"""Turn the names a model produced into database ids, or refuse them (#242).

Split in two on purpose:

* :func:`load_context` touches the database once and returns plain lookup
  tables.
* :func:`resolve_entry` is pure. It is the part most likely to need tuning,
  and it is exhaustively testable with no database and no model call.

Two rules run through all of it:

* **Never a nearest match.** An unresolvable name becomes ``None``. A blank
  field costs the farmer one tap; a wrong one corrupts a record they may not
  notice until harvest.
* **Only the farmer's own rows are searched.** Crops and lands are looked up
  within the tenant, so an id belonging to someone else is not merely
  rejected — it is never a candidate. Postgres RLS does not apply on Neon's
  hosted roles (BACKEND_PLAN.md §11), so this is a real boundary, not a
  convenience.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select

from myfarm_api.core.db import get_session_factory
from myfarm_api.models import ActivityType, Crop, CropCatalog, ExpenseCategory, Land
from myfarm_api.schemas.chat_entry import (
    DroppedField,
    ParsedEntry,
    ResolvedEntry,
    ResolvedExpense,
)


class UnresolvableActivityType(Exception):
    """The entry has no usable activity type, so no activity can be created.

    `activity.activity_type_id` is NOT NULL, so unlike every other field this
    one cannot degrade to null — without it there is nothing to save.
    """


def normalize(value: str) -> str:
    """Casefold and collapse whitespace for forgiving name matching."""
    return " ".join(value.split()).casefold()


@dataclass(frozen=True)
class ResolutionContext:
    """Name → id lookups for one farmer, at one moment.

    Values are *lists* of ids so that two rows sharing a name can be detected
    and dropped as ambiguous rather than silently resolving to whichever one
    the database returned first.
    """

    activity_types: dict[str, list[int]] = field(default_factory=dict)
    expense_categories: dict[str, list[int]] = field(default_factory=dict)
    lands: dict[str, list[int]] = field(default_factory=dict)
    crops: dict[str, list[int]] = field(default_factory=dict)

    # The same names in their original casing, for the prompt. Kept here so
    # the values offered to the model and the values the resolver will accept
    # come from one read of the reference tables — two separate queries leave
    # a window in which they can disagree, and a name the model was told to
    # use but the resolver then rejects is the worst of both.
    activity_type_names: list[str] = field(default_factory=list)
    expense_category_names: list[str] = field(default_factory=list)


def _add(table: dict[str, list[int]], name: str | None, row_id: int) -> None:
    if not name:
        return
    key = normalize(name)
    if not key:
        return
    table.setdefault(key, []).append(row_id)


async def load_context(farmer_id: int) -> ResolutionContext:
    """Read the reference tables and this farmer's own crops and lands."""
    context = ResolutionContext()
    session_factory = get_session_factory()
    async with session_factory() as session:
        for name, row_id in (await session.execute(
            select(ActivityType.name, ActivityType.id).order_by(ActivityType.name)
        )).all():
            _add(context.activity_types, name, row_id)
            context.activity_type_names.append(name)

        for name, row_id in (await session.execute(
            select(ExpenseCategory.name, ExpenseCategory.id).order_by(ExpenseCategory.name)
        )).all():
            _add(context.expense_categories, name, row_id)
            context.expense_category_names.append(name)

        # Tenant scoping lives in these WHERE clauses. Anything outside the
        # farmer's own rows is never a candidate for resolution.
        for name, row_id in (await session.execute(
            select(Land.name, Land.id).where(
                Land.farmer_id == farmer_id, Land.deleted_at.is_(None)
            )
        )).all():
            _add(context.lands, name, row_id)

        crop_rows = (await session.execute(
            select(Crop.id, Crop.label, CropCatalog.name, CropCatalog.common_names)
            .join(CropCatalog, Crop.crop_catalog_id == CropCatalog.id)
            .where(Crop.farmer_id == farmer_id, Crop.deleted_at.is_(None))
        )).all()
        for row_id, label, catalog_name, common_names in crop_rows:
            # A farmer says "cotton", "kapas" or their own label for the same
            # planting. `crop_catalog.common_names` exists for exactly this.
            _add(context.crops, label, row_id)
            _add(context.crops, catalog_name, row_id)
            for alias in (common_names or "").split(","):
                _add(context.crops, alias.strip(), row_id)

    return context


def _lookup(
    table: dict[str, list[int]],
    name: str | None,
    field_name: str,
    dropped: list[DroppedField],
) -> int | None:
    """Resolve one name, recording why it was dropped when it is not usable.

    A name matching several rows is dropped as ``ambiguous`` rather than
    resolved to an arbitrary one — picking wrongly here is exactly the silent
    corruption the whole design is trying to avoid.

    Note there is no ``not_owned`` reason. Only the farmer's own rows are in
    the table, so "belongs to someone else" and "does not exist" are the same
    answer — and keeping them indistinguishable is deliberate, matching the
    404-not-403 choice in #246: the difference is itself a disclosure about
    another tenant.
    """
    if not name or not name.strip():
        return None
    matches = table.get(normalize(name), [])
    if len(matches) == 1:
        return matches[0]
    dropped.append(
        DroppedField(
            field=field_name,
            value=name,
            reason="ambiguous" if matches else "not_found",
        )
    )
    return None


def resolve_entry(parsed: ParsedEntry, context: ResolutionContext) -> ResolvedEntry:
    """Resolve a parsed entry against one farmer's data.

    Raises :class:`UnresolvableActivityType` when the activity type is missing
    or unknown — the only field whose absence makes the entry unusable.
    """
    dropped: list[DroppedField] = []

    activity_type_id = _lookup(
        context.activity_types, parsed.activity_type, "activity_type", dropped
    )
    if activity_type_id is None or parsed.activity_type is None:
        raise UnresolvableActivityType(parsed.activity_type or "")

    land_id = _lookup(context.lands, parsed.land, "land", dropped)
    crop_id = _lookup(context.crops, parsed.crop, "crop", dropped)

    expenses = [
        ResolvedExpense(
            expense_category_id=_lookup(
                context.expense_categories, e.category, "expense_category", dropped
            ),
            # The name is kept even when the id did not resolve, so the UI can
            # show what the farmer said and let them pick the right category.
            category=e.category,
            quantity=e.quantity,
            unit=e.unit,
            rate=e.rate,
            amount=e.amount,
            remarks=e.remarks,
        )
        for e in parsed.expenses
    ]

    return ResolvedEntry(
        transcript=parsed.transcript,
        activity_type_id=activity_type_id,
        activity_type=parsed.activity_type,
        date=parsed.date,
        crop_id=crop_id,
        crop=parsed.crop if crop_id is not None else None,
        land_id=land_id,
        land=parsed.land if land_id is not None else None,
        notes=parsed.notes,
        expenses=expenses,
        dropped=dropped,
    )
