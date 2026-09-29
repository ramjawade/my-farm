"""Assistant query layer against a real database (#287)."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient

from myfarm_api.core import assistant_queries as q
from myfarm_api.core.assistant_queries import Scope
from myfarm_api.core.db import get_session_factory
from myfarm_api.models import ExpenseCategory
from myfarm_api.repositories.farmer import FarmerRepository

AUTH = {"Authorization": "Bearer test"}


@contextmanager
def signed_in(uid: str) -> Iterator[None]:
    with patch.object(
        firebase_auth,
        "verify_id_token",
        return_value={"uid": uid, "phone_number": None},
    ):
        yield


async def post(client: AsyncClient, path: str, body: dict[str, Any]) -> dict[str, Any]:
    resp = await client.post(f"/api/v1/{path}", headers=AUTH, json=body)
    assert resp.status_code == 201, resp.text
    result: dict[str, Any] = resp.json()
    return result


class Farm:
    """One farmer with a land, a crop, and helpers to add activities/expenses."""

    def __init__(self, client: AsyncClient, ref: dict[str, str], uid: str) -> None:
        self.client = client
        self.ref = ref
        self.uid = uid
        self.farmer_id = 0
        self.land_id = 0
        self.crop_id = 0

    async def setup(self, land_name: str = "Plot 1", label: str | None = None) -> "Farm":
        farm = await post(self.client, "farms", {"name": "Farm"})
        land = await post(
            self.client,
            "lands",
            {
                "name": land_name,
                "farm_id": farm["id"],
                "area_sq_m": "1000",
                "points": [
                    {"lat": "18.0", "lng": "73.0"},
                    {"lat": "20.0", "lng": "75.0"},
                ],
            },
        )
        crop = await post(
            self.client,
            "crops",
            {
                "land_id": land["id"],
                "crop_catalog_id": int(self.ref["crop_catalog_id"]),
                "label": label,
            },
        )
        self.land_id, self.crop_id = land["id"], crop["id"]
        self.farmer_id = (await FarmerRepository.get_or_create(self.uid)).id
        return self

    async def activity(self, **fields: Any) -> int:
        body = {"activity_type_id": int(self.ref["activity_type_id"]), **fields}
        return int((await post(self.client, "activities", body))["id"])

    async def expense(self, activity_id: int, amount: str, category_id: str | None = None) -> int:
        body = {
            "expense_category_id": int(category_id or self.ref["expense_category_id"]),
            "amount": amount,
        }
        return int((await post(self.client, f"activities/{activity_id}/expenses", body))["id"])


@pytest.mark.asyncio
async def test_spend_matches_the_activity_summary(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        a1 = await farm.activity(crop_id=farm.crop_id, date="2026-09-10", status="Completed")
        a2 = await farm.activity(crop_id=farm.crop_id, date="2026-08-01", status="Completed")
        await farm.expense(a1, "250.00")
        await farm.expense(a2, "100.50")
        gone = await farm.expense(a2, "9999")
        await client.delete(f"/api/v1/activities/{a2}/expenses/{gone}", headers=AUTH)

        summary = (await client.get("/api/v1/activities/summary", headers=AUTH)).json()
        by_crop = (
            await client.get(
                "/api/v1/activities/summary", headers=AUTH, params={"crop_id": farm.crop_id}
            )
        ).json()

    everything = await q.spend(farm.farmer_id, Scope())
    assert everything == {"total": summary["total_expense"], "expense_count": 2}
    assert everything["total"] == 350.5

    scoped = await q.spend(farm.farmer_id, Scope(crop_ids=(farm.crop_id,)))
    assert scoped["total"] == by_crop["total_expense"]


@pytest.mark.asyncio
async def test_spend_never_includes_another_farmers_data(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid_a, uid_b = f"farmer_a_{uuid4()}", f"farmer_b_{uuid4()}"
    with signed_in(uid_a):
        a = await Farm(client, reference_ids, uid_a).setup()
        await a.expense(await a.activity(crop_id=a.crop_id), "100")
    with signed_in(uid_b):
        b = await Farm(client, reference_ids, uid_b).setup()
        await b.expense(await b.activity(crop_id=b.crop_id), "999")

    assert (await q.spend(a.farmer_id, Scope()))["total"] == 100.0
    assert (await q.spend(a.farmer_id, Scope(crop_ids=(b.crop_id,))))["expense_count"] == 0
    assert len(await q.recent_activities(a.farmer_id, Scope())) == 1
    assert [x["id"] for x in await q.lands(a.farmer_id)] == [a.land_id]
    assert [c["id"] for c in await q.crops(a.farmer_id)] == [a.crop_id]


@pytest.mark.asyncio
async def test_spend_with_nothing_recorded_reports_a_zero_count(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.activity(crop_id=farm.crop_id)  # an activity, but no expense

    assert await q.spend(farm.farmer_id, Scope()) == {"total": 0.0, "expense_count": 0}


@pytest.mark.asyncio
async def test_spend_respects_the_period(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.expense(await farm.activity(date="2026-09-10"), "100")
        await farm.expense(await farm.activity(date="2026-08-31"), "40")
        await farm.expense(await farm.activity(), "7")  # undated

    sept = Scope(start="2026-09-01", end="2026-09-30")
    assert (await q.spend(farm.farmer_id, sept))["total"] == 100.0
    assert (await q.spend(farm.farmer_id, Scope()))["total"] == 147.0


@pytest.mark.asyncio
async def test_land_scope_also_covers_crops_planted_on_it(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        # Carries only a crop, no land_id — must still count for the land.
        await farm.expense(await farm.activity(crop_id=farm.crop_id), "60")
        await farm.expense(await farm.activity(land_id=farm.land_id), "5")

    assert (await q.spend(farm.farmer_id, Scope(land_id=farm.land_id)))["total"] == 65.0


@pytest.mark.asyncio
async def test_spend_by_category_groups_and_orders(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    async with get_session_factory()() as session:
        other_name = f"OtherCategory-{uuid4()}"
        other = ExpenseCategory(name=other_name)
        session.add(other)
        await session.commit()
        other_id = str(other.id)

    uid = f"farmer_{uuid4()}"
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        activity = await farm.activity()
        await farm.expense(activity, "30")
        await farm.expense(activity, "20")
        await farm.expense(activity, "80", category_id=other_id)

    rows = await q.spend_by_category(farm.farmer_id, Scope())
    assert [(r["category"] == other_name, r["total"]) for r in rows] == [
        (True, 80.0),
        (False, 50.0),
    ]


@pytest.mark.asyncio
async def test_pending_and_recent_activities(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.activity(date="2026-09-20", status="Completed")
        soon = await farm.activity(date="2026-10-01", status="Scheduled", land_id=farm.land_id)
        later = await farm.activity(date="2026-10-09", status="In Progress")
        await farm.activity(status="Draft", custom_activity_name="Undated job")
        await farm.activity(date="2026-10-02", status="Cancelled")

    pending = await q.pending_activities(farm.farmer_id, Scope())
    assert [p["id"] for p in pending[:2]] == [soon, later]  # soonest first
    assert pending[-1]["activity"] == "Undated job"  # undated last
    assert {p["status"] for p in pending} == {"Scheduled", "In Progress", "Draft"}
    assert pending[0]["land"] == "Plot 1"

    recent = await q.recent_activities(farm.farmer_id, Scope(), limit=2)
    assert [r["date"] for r in recent] == ["2026-10-09", "2026-10-02"]


@pytest.mark.asyncio
async def test_lands_and_crops_facts(client: AsyncClient, reference_ids: dict[str, str]) -> None:
    uid = f"farmer_{uuid4()}"
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup(label="Front patch")

    lands = await q.lands(farm.farmer_id)
    assert [(x["name"], x["area_sq_m"], x["crops"]) for x in lands] == [
        ("Plot 1", 1000.0, ["Front patch"])
    ]
    crops = await q.crops(farm.farmer_id)
    assert [(c["name"], c["land"], c["status"]) for c in crops] == [
        ("Front patch", "Plot 1", "active")
    ]


@pytest.mark.asyncio
async def test_load_names_resolves_labels_catalogue_names_and_only_own_rows(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid_a, uid_b = f"farmer_a_{uuid4()}", f"farmer_b_{uuid4()}"
    with signed_in(uid_a):
        a = await Farm(client, reference_ids, uid_a).setup(label="Front patch")
    with signed_in(uid_b):
        b = await Farm(client, reference_ids, uid_b).setup(land_name="Farmer B Land")

    names = await q.load_names(a.farmer_id)
    assert q.match_land(names, "plot 1").ids == (a.land_id,)
    assert q.match_land(names, "Farmer B Land").kind == "unknown"
    assert q.match_crops(names, "front patch").ids == (a.crop_id,)
    assert b.crop_id not in q.match_crops(names, "front patch").ids


@pytest.mark.asyncio
async def test_weather_for_land_uses_the_land_centroid(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()

    live = {"data": {"main": {"temp": 31}, "weather": [{"description": "clear"}]}, "source": "live"}
    with patch.object(q, "get_weather", AsyncMock(return_value=live)) as get_weather:
        result = await q.weather_for_land(farm.farmer_id, None)

    assert (result.status, result.land) == ("ok", "Plot 1")
    get_weather.assert_awaited_once_with(19.0, 74.0)
