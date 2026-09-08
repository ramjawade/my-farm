"""Proves `TenantScopedRepository`'s guarantees against real Postgres, using
a throwaway table — not a Stage 3 domain model, since this is infrastructure
that has to be right before any domain table exists on top of it.
"""

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import cast

import pytest
import pytest_asyncio
from sqlalchemy import DateTime, String, Table, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from myfarm_api.core.db import Base
from myfarm_api.repositories.base import NotOwnedError, TenantScopedRepository


class _Widget(Base):
    __tablename__ = "_test_widgets"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    farmer_id: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# mypy flags this as `_Widget` not satisfying the `FarmerOwnedRecord` bound,
# even though direct assignment (`x: FarmerOwnedRecord = _Widget(...)`) type
# checks cleanly — confirmed in isolation with both PEP 695 and legacy
# `TypeVar`/`Generic` syntax, so it's not specific to either. This is a
# known mypy inconsistency between assignability and generic bound-checking
# for Protocols, not a real conformance gap: the tests below exercise every
# method at runtime against real Postgres.
class _WidgetRepository(TenantScopedRepository[_Widget]):  # type: ignore[type-var]
    model = _Widget


def _now() -> datetime:
    return datetime.now(UTC)


@pytest_asyncio.fixture(autouse=True)
async def _widget_table(superuser_engine: AsyncEngine) -> AsyncIterator[None]:
    # DeclarativeBase.__table__ is typed as the more general `FromClause` in
    # SQLAlchemy's stubs; it's always a concrete `Table` for a mapped class.
    table = cast(Table, _Widget.__table__)
    async with superuser_engine.begin() as conn:
        await conn.run_sync(table.create, checkfirst=True)
    yield
    async with superuser_engine.begin() as conn:
        await conn.run_sync(table.drop, checkfirst=True)


async def test_create_and_get_is_scoped_to_owner(db_session: AsyncSession) -> None:
    repo_a = _WidgetRepository(db_session, "farmer-a")
    await repo_a.create(_Widget(id="w1", farmer_id="farmer-a", name="Alpha", updated_at=_now()))

    assert (await repo_a.get("w1")) is not None

    repo_b = _WidgetRepository(db_session, "farmer-b")
    assert (await repo_b.get("w1")) is None


async def test_create_for_another_farmer_is_rejected(db_session: AsyncSession) -> None:
    repo = _WidgetRepository(db_session, "farmer-a")
    widget = _Widget(id="w2", farmer_id="farmer-b", name="Bravo", updated_at=_now())
    with pytest.raises(NotOwnedError):
        await repo.create(widget)


async def test_update_cannot_move_a_row_to_another_farmer(db_session: AsyncSession) -> None:
    repo = _WidgetRepository(db_session, "farmer-a")
    await repo.create(_Widget(id="w3", farmer_id="farmer-a", name="Charlie", updated_at=_now()))

    updated = await repo.update("w3", name="Charlie2", farmer_id="farmer-b")

    assert updated is not None
    assert updated.farmer_id == "farmer-a"  # farmer_id is identity — silently ignored, not moved
    assert updated.name == "Charlie2"


async def test_update_is_scoped_to_owner(db_session: AsyncSession) -> None:
    repo_a = _WidgetRepository(db_session, "farmer-a")
    await repo_a.create(_Widget(id="w4", farmer_id="farmer-a", name="Delta", updated_at=_now()))

    repo_b = _WidgetRepository(db_session, "farmer-b")
    result = await repo_b.update("w4", name="Hijacked")

    assert result is None  # farmer B cannot see, let alone update, farmer A's row
    unchanged = await repo_a.get("w4")
    assert unchanged is not None
    assert unchanged.name == "Delta"


async def test_soft_delete_hides_but_does_not_erase(db_session: AsyncSession) -> None:
    repo = _WidgetRepository(db_session, "farmer-a")
    await repo.create(_Widget(id="w5", farmer_id="farmer-a", name="Echo", updated_at=_now()))

    assert await repo.soft_delete("w5") is True
    assert await repo.get("w5") is None  # hidden from normal reads...

    row = (await db_session.execute(select(_Widget).where(_Widget.id == "w5"))).scalar_one()
    assert row.deleted_at is not None  # ...but the row is a tombstone, not erased


async def test_soft_delete_is_scoped_to_owner(db_session: AsyncSession) -> None:
    repo_a = _WidgetRepository(db_session, "farmer-a")
    await repo_a.create(_Widget(id="w6", farmer_id="farmer-a", name="Foxtrot", updated_at=_now()))

    repo_b = _WidgetRepository(db_session, "farmer-b")
    assert await repo_b.soft_delete("w6") is False
    assert (await repo_a.get("w6")) is not None


async def test_repository_cannot_be_constructed_without_a_farmer_id(
    db_session: AsyncSession,
) -> None:
    with pytest.raises(ValueError):
        _WidgetRepository(db_session, "")


async def test_pagination_walks_every_row_in_order_without_duplicates(
    db_session: AsyncSession,
) -> None:
    repo = _WidgetRepository(db_session, "farmer-page")
    base = _now()
    for i in range(5):
        await repo.create(
            _Widget(
                id=f"p{i}",
                farmer_id="farmer-page",
                name=f"item-{i}",
                updated_at=base.replace(microsecond=i * 1000),
            )
        )

    seen: list[str] = []
    cursor: str | None = None
    for _ in range(10):
        rows, cursor = await repo.list(limit=2, cursor=cursor)
        seen.extend(r.id for r in rows)
        if cursor is None:
            break

    assert seen == [f"p{i}" for i in range(5)]


async def test_pagination_excludes_soft_deleted_rows(db_session: AsyncSession) -> None:
    repo = _WidgetRepository(db_session, "farmer-page2")
    await repo.create(_Widget(id="q1", farmer_id="farmer-page2", name="keep", updated_at=_now()))
    await repo.create(_Widget(id="q2", farmer_id="farmer-page2", name="gone", updated_at=_now()))
    await repo.soft_delete("q2")

    rows, cursor = await repo.list(limit=10)

    assert [r.id for r in rows] == ["q1"]
    assert cursor is None
