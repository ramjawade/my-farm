"""GET /api/v1/assistant/brief (#289)."""

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from myfarm_api.core import assistant_queries
from tests.assistant_helpers import AUTH, Farm, signed_in

URL = "/api/v1/assistant/brief"
LIVE: dict[str, Any] = {
    "data": {
        "main": {"temp": 31, "humidity": 60},
        "weather": [{"description": "clear sky"}],
    },
    "source": "live",
}


def days_from_today(n: int) -> str:
    return (datetime.now(UTC).date() + timedelta(days=n)).isoformat()


@pytest.mark.asyncio
async def test_new_farmer_gets_only_the_welcome_flag(client: AsyncClient) -> None:
    with signed_in(f"farmer_{uuid4()}"):
        resp = await client.get(URL, headers=AUTH)

    assert resp.status_code == 200
    assert resp.json() == {
        "has_data": False,
        "name": None,
        "weather": None,
        "pending": None,
        "spend_7d": None,
    }


@pytest.mark.asyncio
async def test_farmer_with_data_gets_every_section(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        for i, status in enumerate(("Scheduled", "In Progress", "Draft", "Scheduled")):
            await farm.activity(status=status, land_id=farm.land_id, date=days_from_today(i))
        await farm.expense(await farm.activity(date=days_from_today(-2)), "400")
        await farm.expense(await farm.activity(date=days_from_today(-3)), "100.5")
        # Outside the 7-day window: must not count.
        await farm.expense(await farm.activity(date=days_from_today(-30)), "9999")

        with patch.object(assistant_queries, "get_weather", AsyncMock(return_value=LIVE)):
            resp = await client.get(URL, headers=AUTH)

    body = resp.json()
    assert body["has_data"] is True
    assert body["weather"] == {
        "land": "Plot 1",
        "temp_c": 31,
        "description": "clear sky",
        "humidity_pct": 60,
        "source": "live",
    }
    assert body["pending"]["count"] == 4
    assert len(body["pending"]["next"]) == 3  # only the soonest few
    assert body["pending"]["next"][0]["land"] == "Plot 1"
    assert body["spend_7d"] == {"total": 500.5}


@pytest.mark.asyncio
async def test_empty_sections_are_omitted(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.activity(status="Completed")
        with patch.object(assistant_queries, "land_locations", AsyncMock(return_value=[])):
            body = (await client.get(URL, headers=AUTH)).json()

    assert body["has_data"] is True  # they have a land and an activity
    assert body["weather"] is None
    assert body["pending"] is None
    assert body["spend_7d"] is None


@pytest.mark.asyncio
async def test_weather_failure_drops_only_the_weather(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.activity(status="Scheduled")
        with patch.object(
            assistant_queries, "get_weather", AsyncMock(side_effect=RuntimeError("down"))
        ):
            resp = await client.get(URL, headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    assert body["weather"] is None
    assert body["pending"]["count"] == 1


@pytest.mark.asyncio
async def test_several_mapped_lands_use_the_first_for_weather(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.add_land("Plot 2")
        with patch.object(assistant_queries, "get_weather", AsyncMock(return_value=LIVE)):
            body = (await client.get(URL, headers=AUTH)).json()

    assert body["weather"]["land"] == "Plot 1"


@pytest.mark.asyncio
async def test_brief_is_per_farmer(client: AsyncClient, reference_ids: dict[str, str]) -> None:
    uid_a, uid_b = f"farmer_a_{uuid4()}", f"farmer_b_{uuid4()}"
    with signed_in(uid_a):
        a = await Farm(client, reference_ids, uid_a).setup()
        await a.expense(await a.activity(status="Scheduled", date=days_from_today(-1)), "777")

    with signed_in(uid_b):
        body = (await client.get(URL, headers=AUTH)).json()

    assert body["has_data"] is False
    assert body["pending"] is None
    assert body["spend_7d"] is None


@pytest.mark.asyncio
async def test_brief_needs_no_model_provider(client: AsyncClient) -> None:
    """No provider override and no API key configured: the brief must still load."""
    with signed_in(f"farmer_{uuid4()}"):
        resp = await client.get(URL, headers=AUTH)

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient) -> None:
    assert (await client.get(URL)).status_code in (401, 403)
