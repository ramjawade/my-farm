"""Migration 0012 copies live crop_sale rows into Completed Sale activities."""

import subprocess
import sys
from pathlib import Path
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from firebase_admin import auth as firebase_auth
from httpx import AsyncClient
from sqlalchemy import text

from myfarm_api.core.db import get_session_factory

HEADERS = {"Authorization": "Bearer test"}
BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _alembic(*args: str) -> None:
    subprocess.run([sys.executable, "-m", "alembic", *args], cwd=BACKEND_ROOT, check=True)


async def _make_crop(client: AsyncClient, reference_ids: dict[str, str]) -> int:
    farm = await client.post("/api/v1/farms", headers=HEADERS, json={"name": "F", "state": "MH"})
    land = await client.post(
        "/api/v1/lands", headers=HEADERS, json={"name": "L", "farm_id": str(farm.json()["id"])}
    )
    crop = await client.post(
        "/api/v1/crops",
        headers=HEADERS,
        json={
            "name": "Tomato",
            "land_id": str(land.json()["id"]),
            "crop_catalog_id": reference_ids["crop_catalog_id"],
        },
    )
    assert crop.status_code == 201
    return int(crop.json()["id"])


@pytest.mark.asyncio
async def test_live_sales_become_completed_sale_activities(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    verify: Any = patch.object(
        firebase_auth, "verify_id_token", return_value={"uid": uid, "phone_number": None}
    )
    with verify:
        crop_id = await _make_crop(client, reference_ids)

    session_factory = get_session_factory()
    async with session_factory() as session:
        await session.execute(
            text(
                """
                INSERT INTO crop_sale (crop_id, sold_on, quantity, unit, rate, amount, buyer, notes,
                                       deleted_at)
                VALUES
                  (:c, '2026-10-02', 12, 'crates', 1250, 15000, 'Nashik APMC', 'cash', NULL),
                  (:c, '2026-12-05', 10, 'kg', 30, 300, NULL, NULL, NULL),
                  (:c, '2026-09-30', 1, 'bags', 100, 100, NULL, NULL, now())
                """
            ),
            {"c": crop_id},
        )
        await session.commit()

    _alembic("downgrade", "0011_watchlists")
    try:
        _alembic("upgrade", "0012_sale_activity_columns")
        async with session_factory() as session:
            rows = (
                await session.execute(
                    text(
                        """
                        SELECT a.date, a.season, a.status, a.notes, a.crop_id, a.land_id,
                               a.sale_quantity, a.sale_unit, a.sale_rate, a.sale_amount,
                               a.sale_buyer, t.name
                        FROM activity a JOIN activity_type t ON t.id = a.activity_type_id
                        WHERE a.crop_id = :c ORDER BY a.date
                        """
                    ),
                    {"c": crop_id},
                )
            ).all()
        assert len(rows) == 2, "soft-deleted sale must not be copied"
        first, second = rows
        assert first.name == "Sale" and first.status == "Completed"
        assert first.date == "2026-10-02" and first.season == "Kharif"
        assert first.notes == "cash" and first.land_id is not None
        assert (first.sale_quantity, first.sale_unit) == (12, "crates")
        assert (first.sale_rate, first.sale_amount) == (1250, 15000)
        assert first.sale_buyer == "Nashik APMC"
        assert second.date == "2026-12-05" and second.season == "Rabi"
        assert second.sale_buyer is None

        # Downgrade removes only the copied activities and leaves crop_sale alone.
        _alembic("downgrade", "0011_watchlists")
        async with session_factory() as session:
            sales = await session.scalar(
                text("SELECT count(*) FROM crop_sale WHERE crop_id = :c"), {"c": crop_id}
            )
            acts = await session.scalar(
                text("SELECT count(*) FROM activity WHERE crop_id = :c"), {"c": crop_id}
            )
        assert sales == 3
        assert acts == 0
    finally:
        _alembic("upgrade", "head")
