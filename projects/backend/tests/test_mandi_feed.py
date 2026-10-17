"""Parsing of mandi feed records (the backend does not call the feed)."""

import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from myfarm_api.core.mandi_feed import parse_record

SAMPLE = json.loads((Path(__file__).parent / "fixtures" / "mandi_feed_sample.json").read_text())


def test_parse_record_reads_the_feeds_shape() -> None:
    row = parse_record(SAMPLE["records"][0])
    assert row is not None
    assert row.price_date == date(2026, 10, 17)  # dd/mm/yyyy
    assert (row.market, row.commodity, row.grade) == ("Lasalgaon APMC", "Maize", "FAQ")
    assert float(row.modal_price) == 2100


@pytest.mark.parametrize(
    "change",
    [
        {"arrival_date": "not a date"},
        {"modal_price": -1},
        {"market": ""},
        {"min_price": "abc"},
        {"max_price": "NaN"},
        {"max_price": "Infinity"},
        {"modal_price": 10**8},
    ],
)
def test_parse_record_rejects_unusable_rows(change: dict[str, Any]) -> None:
    assert parse_record({**SAMPLE["records"][0], **change}) is None


def test_parse_record_rejects_missing_fields() -> None:
    record = dict(SAMPLE["records"][0])
    del record["arrival_date"]
    assert parse_record(record) is None


def test_the_sample_has_one_bad_row() -> None:
    parsed = [parse_record(r) for r in SAMPLE["records"]]
    assert [p is None for p in parsed] == [False, False, False, True]


def test_prices_may_arrive_as_text() -> None:
    row = parse_record({**SAMPLE["records"][0], "modal_price": "2100.50", "min_price": "2000"})
    assert row is not None and float(row.modal_price) == 2100.5
