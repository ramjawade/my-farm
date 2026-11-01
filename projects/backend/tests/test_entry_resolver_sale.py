"""Sale figures in name-to-id resolution: pure tests, no database or model call."""

from decimal import Decimal

import pytest

from myfarm_api.core.entry_resolver import ResolutionContext, resolve_entry
from myfarm_api.schemas.chat_entry import ParsedEntry


def _context() -> ResolutionContext:
    return ResolutionContext(
        activity_types={"sale": [9], "irrigation": [2]},
        expense_categories={"labour": [11]},
        lands={"north plot": [20]},
        crops={"tomato": [30]},
    )


def _parsed(**kwargs: object) -> ParsedEntry:
    defaults: dict[str, object] = {"transcript": "t", "activity_type": "Sale"}
    defaults.update(kwargs)
    return ParsedEntry.model_validate(defaults)


def test_sale_figures_pass_through_for_a_sale() -> None:
    out = resolve_entry(
        _parsed(
            crop="Tomato",
            sale_quantity=Decimal("12"),
            sale_unit="crates",
            sale_rate=Decimal("1250"),
            sale_buyer="Nashik APMC",
        ),
        _context(),
    )
    assert out.activity_type_id == 9
    assert out.crop_id == 30
    assert (out.sale_quantity, out.sale_unit) == (Decimal("12"), "crates")
    assert out.sale_rate == Decimal("1250")
    assert out.sale_amount is None
    assert out.sale_buyer == "Nashik APMC"


def test_a_stated_total_is_kept_and_nothing_is_calculated() -> None:
    out = resolve_entry(
        _parsed(sale_quantity=Decimal("12"), sale_unit="crates", sale_amount=Decimal("15000")),
        _context(),
    )
    assert out.sale_amount == Decimal("15000")
    assert out.sale_rate is None


def test_missing_sale_figures_are_not_a_dropped_field() -> None:
    out = resolve_entry(_parsed(), _context())
    assert out.sale_quantity is None
    assert out.sale_rate is None
    assert out.sale_amount is None
    assert out.dropped == []


@pytest.mark.parametrize("bad", [Decimal("0"), Decimal("-5")])
def test_zero_and_negative_sale_numbers_become_null(bad: Decimal) -> None:
    out = resolve_entry(_parsed(sale_quantity=bad, sale_rate=bad, sale_amount=bad), _context())
    assert (out.sale_quantity, out.sale_rate, out.sale_amount) == (None, None, None)


def test_blank_sale_text_becomes_null() -> None:
    out = resolve_entry(_parsed(sale_unit="   ", sale_buyer=""), _context())
    assert out.sale_unit is None
    assert out.sale_buyer is None


def test_sale_text_is_trimmed() -> None:
    out = resolve_entry(_parsed(sale_unit=" kg ", sale_buyer=" Patil Traders "), _context())
    assert (out.sale_unit, out.sale_buyer) == ("kg", "Patil Traders")


def test_the_type_name_matches_without_regard_to_case() -> None:
    out = resolve_entry(_parsed(activity_type="sale", sale_unit="kg"), _context())
    assert out.sale_unit == "kg"


def test_sale_figures_are_cleared_on_another_type() -> None:
    out = resolve_entry(
        _parsed(
            activity_type="Irrigation",
            sale_quantity=Decimal("12"),
            sale_unit="crates",
            sale_rate=Decimal("1250"),
            sale_amount=Decimal("15000"),
            sale_buyer="Someone",
        ),
        _context(),
    )
    assert out.sale_quantity is None
    assert out.sale_unit is None
    assert out.sale_rate is None
    assert out.sale_amount is None
    assert out.sale_buyer is None


def test_a_response_without_sale_fields_still_validates() -> None:
    parsed = ParsedEntry.model_validate({"transcript": "t", "activity_type": "Irrigation"})
    assert parsed.sale_quantity is None
    assert parsed.sale_buyer is None
