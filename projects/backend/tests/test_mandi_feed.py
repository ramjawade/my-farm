"""The mandi feed client: record parsing and paging, with no network."""

import json
from datetime import date
from pathlib import Path
from typing import Any

import httpx
import pytest

from myfarm_api.core.config import get_settings
from myfarm_api.core.mandi_feed import FeedError, MandiFeed, parse_record

SAMPLE = json.loads((Path(__file__).parent / "fixtures" / "mandi_feed_sample.json").read_text())


def test_parse_record_reads_the_feeds_shape() -> None:
    row = parse_record(SAMPLE["records"][0])
    assert row is not None
    assert row.price_date == date(2026, 10, 17)  # dd/mm/yyyy
    assert (row.market, row.commodity, row.grade) == ("Lasalgaon APMC", "Maize", "FAQ")
    assert float(row.modal_price) == 2100


@pytest.mark.parametrize(
    "change",
    [{"arrival_date": "not a date"}, {"modal_price": -1}, {"market": ""}, {"min_price": "abc"}],
)
def test_parse_record_rejects_unusable_rows(change: dict[str, Any]) -> None:
    assert parse_record({**SAMPLE["records"][0], **change}) is None


def test_parse_record_rejects_missing_fields() -> None:
    record = dict(SAMPLE["records"][0])
    del record["arrival_date"]
    assert parse_record(record) is None


def _patch_client(monkeypatch: pytest.MonkeyPatch, handler: Any) -> None:
    real = httpx.AsyncClient

    def factory(**kwargs: Any) -> httpx.AsyncClient:
        return real(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr("myfarm_api.core.mandi_feed.httpx.AsyncClient", factory)
    monkeypatch.setattr(get_settings(), "mandi_api_key", "test-key")
    monkeypatch.setattr(get_settings(), "mandi_page_size", 2)


@pytest.mark.asyncio
async def test_fetch_pages_and_counts_unusable_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        params = dict(request.url.params)
        seen.append(params)
        offset = int(params["offset"])
        records = SAMPLE["records"][offset : offset + 2]
        return httpx.Response(200, json={**SAMPLE, "records": records, "count": len(records)})

    _patch_client(monkeypatch, handler)
    rows, skipped = await MandiFeed().fetch_commodity("Maize")

    assert len(rows) == 3 and skipped == 1
    assert [p["offset"] for p in seen] == ["0", "2"]
    assert seen[0]["api-key"] == "test-key"
    assert seen[0]["filters[state.keyword]"] == get_settings().mandi_state
    assert seen[0]["filters[commodity]"] == "Maize"


@pytest.mark.asyncio
async def test_fetch_failure_does_not_leak_the_key(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_client(monkeypatch, lambda request: httpx.Response(500))
    with pytest.raises(FeedError) as err:
        await MandiFeed().fetch_commodity("Maize")
    assert "test-key" not in str(err.value)


@pytest.mark.asyncio
async def test_fetch_without_a_key_is_an_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "mandi_api_key", "")
    with pytest.raises(FeedError):
        await MandiFeed().fetch_commodity("Maize")
