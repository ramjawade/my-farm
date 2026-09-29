"""Pure parts of the assistant query layer (#287): no database, no network."""

from datetime import date
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from myfarm_api.core import assistant_queries as q
from myfarm_api.core.assistant_queries import CropName, FarmerNames, LandLocation

# ----------------------------------------------------------------- periods

TODAY = date(2026, 9, 30)  # a Wednesday


@pytest.mark.parametrize(
    ("period", "expected"),
    [
        ("all", (None, None)),
        ("today", ("2026-09-30", "2026-09-30")),
        ("last_7_days", ("2026-09-24", "2026-09-30")),
        ("last_30_days", ("2026-09-01", "2026-09-30")),
        ("this_week", ("2026-09-28", "2026-09-30")),
        ("this_month", ("2026-09-01", "2026-09-30")),
        ("last_month", ("2026-08-01", "2026-08-31")),
        ("this_year", ("2026-01-01", "2026-09-30")),
    ],
)
def test_period_bounds(period: Any, expected: tuple[str | None, str | None]) -> None:
    assert q.period_bounds(period, TODAY) == expected


def test_last_month_crosses_a_year_boundary() -> None:
    assert q.period_bounds("last_month", date(2026, 1, 15)) == ("2025-12-01", "2025-12-31")


# ------------------------------------------------------------ name matching


def _names() -> FarmerNames:
    return FarmerNames(
        lands=((1, "Plot 1"), (2, "North Field"), (3, "Back Field"), (4, "back field")),
        crops=(
            CropName(10, "Wheat", 100, frozenset({"wheat", "gehu"})),
            CropName(11, "Wheat", 100, frozenset({"wheat", "gehu"})),
            CropName(12, "Kapas patch", 200, frozenset({"kapas patch", "cotton", "kapas"})),
            CropName(13, "Cotton", 300, frozenset({"cotton"})),
        ),
    )


def test_land_matches_case_and_whitespace_insensitively() -> None:
    match = q.match_land(_names(), "  nOrTh   field ")
    assert (match.kind, match.ids) == ("matched", (2,))


def test_unknown_land_offers_the_farmers_real_lands() -> None:
    match = q.match_land(_names(), "Someone Elses Field")
    assert match.kind == "unknown"
    assert match.ids == ()
    assert set(match.options) == {"Plot 1", "North Field", "Back Field", "back field"}


def test_two_lands_with_one_name_are_ambiguous() -> None:
    match = q.match_land(_names(), "Back Field")
    assert match.kind == "ambiguous"
    assert match.ids == ()


def test_crop_planted_on_two_plots_is_aggregated() -> None:
    match = q.match_crops(_names(), "wheat")
    assert (match.kind, match.ids) == ("matched", (10, 11))


def test_crop_resolves_through_a_vernacular_alias() -> None:
    match = q.match_crops(_names(), "Gehu")
    assert match.ids == (10, 11)


def test_name_reaching_different_catalogue_crops_is_ambiguous() -> None:
    """ "cotton" is a label alias for one crop and the catalogue name of another."""
    match = q.match_crops(_names(), "cotton")
    assert match.kind == "ambiguous"
    assert match.ids == ()
    assert set(match.options) == {"Kapas patch", "Cotton"}


def test_unknown_crop_offers_each_crop_once() -> None:
    match = q.match_crops(_names(), "sugarcane")
    assert match.kind == "unknown"
    assert match.options == ("Cotton", "Kapas patch", "Wheat")


def test_no_crops_at_all_is_unknown_with_no_options() -> None:
    match = q.match_crops(FarmerNames(), "wheat")
    assert (match.kind, match.options) == ("unknown", ())


# ------------------------------------------------------------------ weather


def test_centroid_is_the_mean_of_the_vertices() -> None:
    assert q.centroid([(10.0, 20.0), (12.0, 24.0)]) == (11.0, 22.0)


def test_weather_facts_pick_the_useful_fields() -> None:
    payload = {
        "weather": [{"description": "light rain"}],
        "main": {"temp": 27.5, "feels_like": 29.0, "humidity": 80},
        "wind": {"speed": 3.2},
        "rain": {"1h": 1.4},
    }
    assert q.weather_facts(payload, "live") == {
        "temp_c": 27.5,
        "feels_like_c": 29.0,
        "humidity_pct": 80,
        "description": "light rain",
        "wind_ms": 3.2,
        "rain_mm_1h": 1.4,
        "source": "live",
    }


def test_weather_facts_tolerate_an_empty_payload() -> None:
    facts = q.weather_facts({}, "mock")
    assert facts["temp_c"] is None
    assert facts["description"] is None
    assert facts["source"] == "mock"


LOCATIONS = [LandLocation(1, "Plot 1", 18.5, 73.8), LandLocation(2, "Plot 2", 19.0, 74.0)]
LIVE = {"data": {"main": {"temp": 30}, "weather": [{"description": "clear"}]}, "source": "live"}


async def _weather(
    land_id: int | None, locations: list[LandLocation], get_weather: AsyncMock
) -> q.WeatherResult:
    with (
        patch.object(q, "land_locations", AsyncMock(return_value=locations)),
        patch.object(q, "get_weather", get_weather),
    ):
        return await q.weather_for_land(1, land_id)


@pytest.mark.asyncio
async def test_weather_uses_the_named_land() -> None:
    get_weather = AsyncMock(return_value=LIVE)
    result = await _weather(2, LOCATIONS, get_weather)
    assert (result.status, result.land) == ("ok", "Plot 2")
    assert result.facts is not None and result.facts["temp_c"] == 30
    get_weather.assert_awaited_once_with(19.0, 74.0)


@pytest.mark.asyncio
async def test_weather_uses_the_only_located_land_when_none_is_named() -> None:
    result = await _weather(None, LOCATIONS[:1], AsyncMock(return_value=LIVE))
    assert (result.status, result.land) == ("ok", "Plot 1")


@pytest.mark.asyncio
async def test_weather_asks_which_land_when_several_are_located() -> None:
    get_weather = AsyncMock(return_value=LIVE)
    result = await _weather(None, LOCATIONS, get_weather)
    assert result.status == "ambiguous"
    assert result.options == ("Plot 1", "Plot 2")
    get_weather.assert_not_awaited()


@pytest.mark.asyncio
async def test_weather_reports_no_location_for_a_land_without_points() -> None:
    result = await _weather(99, LOCATIONS, AsyncMock(return_value=LIVE))
    assert result.status == "no_location"


@pytest.mark.asyncio
async def test_weather_reports_no_location_when_no_land_has_points() -> None:
    result = await _weather(None, [], AsyncMock(return_value=LIVE))
    assert result.status == "no_location"


@pytest.mark.asyncio
async def test_weather_failure_is_unavailable_not_an_exception() -> None:
    result = await _weather(1, LOCATIONS, AsyncMock(side_effect=RuntimeError("boom")))
    assert (result.status, result.land, result.facts) == ("unavailable", "Plot 1", None)


@pytest.mark.asyncio
async def test_first_land_avoids_the_ambiguity_for_a_greeting() -> None:
    get_weather = AsyncMock(return_value=LIVE)
    with (
        patch.object(q, "land_locations", AsyncMock(return_value=LOCATIONS)),
        patch.object(q, "get_weather", get_weather),
    ):
        result = await q.weather_for_land(1, None, first_land=True)

    assert (result.status, result.land) == ("ok", "Plot 1")
    get_weather.assert_awaited_once_with(18.5, 73.8)


@pytest.mark.asyncio
async def test_first_land_still_reports_no_location_when_none_is_mapped() -> None:
    with patch.object(q, "land_locations", AsyncMock(return_value=[])):
        result = await q.weather_for_land(1, None, first_land=True)

    assert result.status == "no_location"
