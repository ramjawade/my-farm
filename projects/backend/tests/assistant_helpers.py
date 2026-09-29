"""Shared setup for the assistant's database-backed tests (#287, #288)."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from unittest.mock import patch

from firebase_admin import auth as firebase_auth
from httpx import AsyncClient

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
        self.farm_id = 0
        self.land_id = 0
        self.crop_id = 0

    async def setup(self, land_name: str = "Plot 1", label: str | None = None) -> "Farm":
        farm = await post(self.client, "farms", {"name": "Farm"})
        self.farm_id = farm["id"]
        self.land_id = await self.add_land(land_name)
        self.crop_id = await self.add_crop(self.land_id, label)
        self.farmer_id = (await FarmerRepository.get_or_create(self.uid)).id
        return self

    async def add_land(self, name: str, *, with_points: bool = True) -> int:
        points = [{"lat": "18.0", "lng": "73.0"}, {"lat": "20.0", "lng": "75.0"}]
        land = await post(
            self.client,
            "lands",
            {
                "name": name,
                "farm_id": self.farm_id,
                "area_sq_m": "1000",
                "points": points if with_points else None,
            },
        )
        return int(land["id"])

    async def add_crop(self, land_id: int, label: str | None = None) -> int:
        crop = await post(
            self.client,
            "crops",
            {
                "land_id": land_id,
                "crop_catalog_id": int(self.ref["crop_catalog_id"]),
                "label": label,
            },
        )
        return int(crop["id"])

    async def activity(self, **fields: Any) -> int:
        body = {"activity_type_id": int(self.ref["activity_type_id"]), **fields}
        return int((await post(self.client, "activities", body))["id"])

    async def expense(self, activity_id: int, amount: str, category_id: str | None = None) -> int:
        body = {
            "expense_category_id": int(category_id or self.ref["expense_category_id"]),
            "amount": amount,
        }
        return int((await post(self.client, f"activities/{activity_id}/expenses", body))["id"])
