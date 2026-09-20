"""Name-to-id resolution (#242).

Pure tests: no database, no model call, no HTTP. This is the part of the
chat-entry pipeline most likely to need tuning, so it stays cheap to run and
exhaustive.
"""

from decimal import Decimal

import pytest

from myfarm_api.core.entry_resolver import (
    ResolutionContext,
    UnresolvableActivityType,
    normalize,
    resolve_entry,
)
from myfarm_api.schemas.chat_entry import ParsedEntry, ParsedExpense


def _context(
    activity_types: dict[str, list[int]] | None = None,
    expense_categories: dict[str, list[int]] | None = None,
    lands: dict[str, list[int]] | None = None,
    crops: dict[str, list[int]] | None = None,
) -> ResolutionContext:
    return ResolutionContext(
        activity_types=activity_types
        or {"fertilizer application": [1], "irrigation": [2]},
        expense_categories=expense_categories or {"fertilizer": [10], "labour": [11]},
        lands=lands or {"north plot": [20]},
        # One crop reachable by its catalog name and by a vernacular alias.
        crops=crops or {"cotton": [30], "kapas": [30]},
    )


def _parsed(**kwargs: object) -> ParsedEntry:
    defaults: dict[str, object] = {
        "transcript": "t",
        "activity_type": "Fertilizer Application",
    }
    defaults.update(kwargs)
    return ParsedEntry.model_validate(defaults)


# ------------------------------------------------------------- happy path


def test_resolves_activity_type_to_id() -> None:
    out = resolve_entry(_parsed(), _context())
    assert out.activity_type_id == 1
    assert out.activity_type == "Fertilizer Application"
    assert out.dropped == []


def test_resolves_land_and_crop() -> None:
    out = resolve_entry(_parsed(land="North Plot", crop="cotton"), _context())
    assert (out.land_id, out.crop_id) == (20, 30)


def test_matching_is_case_and_whitespace_insensitive() -> None:
    out = resolve_entry(_parsed(land="  nOrTh   plot "), _context())
    assert out.land_id == 20


def test_crop_resolves_through_a_vernacular_alias() -> None:
    """`crop_catalog.common_names` is what makes "kapas" find Cotton."""
    out = resolve_entry(_parsed(crop="Kapas"), _context())
    assert out.crop_id == 30


# --------------------------------------------------------------- refusals


def test_unknown_activity_type_is_fatal() -> None:
    """activity_type_id is NOT NULL, so this is the one field that cannot
    degrade to null — there would be nothing to save."""
    with pytest.raises(UnresolvableActivityType):
        resolve_entry(_parsed(activity_type="Interpretive Dance"), _context())


def test_missing_activity_type_is_fatal() -> None:
    with pytest.raises(UnresolvableActivityType):
        resolve_entry(_parsed(activity_type=None), _context())


def test_unknown_land_is_dropped_not_guessed() -> None:
    out = resolve_entry(_parsed(land="Someone Elses Field"), _context())
    assert out.land_id is None
    assert out.land is None, "an unresolved name must not be echoed as if it were used"
    assert [(d.field, d.reason) for d in out.dropped] == [("land", "not_found")]
    assert out.dropped[0].value == "Someone Elses Field"


def test_ambiguous_name_is_dropped_not_arbitrarily_picked() -> None:
    """Two lands sharing a name must not silently resolve to whichever row
    the database returned first."""
    out = resolve_entry(_parsed(land="Back Field"), _context(lands={"back field": [21, 22]}))
    assert out.land_id is None
    assert [(d.field, d.reason) for d in out.dropped] == [("land", "ambiguous")]


def test_unknown_expense_category_keeps_the_rest_of_the_line() -> None:
    """A category we do not recognise must not discard a correct amount."""
    out = resolve_entry(
        _parsed(expenses=[ParsedExpense(
                    category="Bribes",
                    amount=Decimal("1600"),
                    unit="bag",
                    quantity=Decimal("2"),
                )]),
        _context(),
    )
    line = out.expenses[0]
    assert line.expense_category_id is None
    assert line.amount == Decimal("1600")
    assert line.quantity == Decimal("2")
    assert line.unit == "bag"
    assert line.category == "Bribes", "keep what was said so the farmer can correct it"
    assert [(d.field, d.reason) for d in out.dropped] == [("expense_category", "not_found")]


def test_empty_and_blank_names_are_not_reported_as_dropped() -> None:
    """Absent is not the same as unrecognised — a null field the model never
    filled should not produce a 'we did not understand that' message."""
    out = resolve_entry(_parsed(land=None, crop="   "), _context())
    assert out.dropped == []


def test_multiple_expenses_resolve_independently() -> None:
    out = resolve_entry(
        _parsed(
            expenses=[
                ParsedExpense(category="Fertilizer", amount=Decimal("1600")),
                ParsedExpense(category="Nonsense", amount=Decimal("50")),
            ]
        ),
        _context(),
    )
    assert [e.expense_category_id for e in out.expenses] == [10, None]
    assert [e.amount for e in out.expenses] == [Decimal("1600"), Decimal("50")]


def test_other_fields_pass_through_untouched() -> None:
    out = resolve_entry(_parsed(date="2026-09-20", notes="urea applied"), _context())
    assert out.date == "2026-09-20"
    assert out.notes == "urea applied"
    assert out.transcript == "t"


def test_normalize() -> None:
    assert normalize("  North   PLOT ") == "north plot"
