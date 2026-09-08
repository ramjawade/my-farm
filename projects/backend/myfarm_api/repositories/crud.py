"""Generic CRUD repository for tenant-scoped entities with cursor pagination."""

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select

from myfarm_api.core.db import get_session_factory
from myfarm_api.models import Base


class UpsertConflict(Exception):
    """A client-minted id collides with a row owned by a different farmer.

    UUIDv7 ids are minted offline by the client (BACKEND_PLAN.md §6.1), so
    a genuine cross-farmer collision should never happen — this only fires
    on a real bug or a bad-faith client, and the sync push endpoint turns
    it into a per-item error rather than a 500 or a silent takeover.
    """


class CursorPage[T]:
    """Cursor-paginated result set."""

    def __init__(
        self, items: list[T], next_cursor: str | None = None, has_more: bool = False
    ) -> None:
        self.items = items
        self.next_cursor = next_cursor
        self.has_more = has_more


class TenantScopedCRUD[T: Base]:
    """Generic CRUD for farmer-owned entities with cursor pagination over (updated_at, id)."""

    def __init__(self, model: type[T]) -> None:
        self.model = model

    async def list(
        self,
        farmer_id: UUID,
        cursor: str | None = None,
        limit: int = 20,
    ) -> CursorPage[T]:
        """List farmer's records, cursor-paginated over (updated_at, id).

        Cursor format: "<updated_at_iso>:<id>"
        """
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = select(self.model).where(
                and_(
                    self.model.farmer_id == farmer_id,
                    self.model.deleted_at.is_(None),
                )
            )

            if cursor:
                updated_at_str, id_str = cursor.rsplit(":", 1)
                cursor_updated_at = datetime.fromisoformat(updated_at_str)
                cursor_id = UUID(id_str)
                stmt = stmt.where(
                    (self.model.updated_at < cursor_updated_at)
                    | (
                        (self.model.updated_at == cursor_updated_at)
                        & (self.model.id < cursor_id)
                    )
                )

            stmt = stmt.order_by(
                self.model.updated_at.desc(), self.model.id.desc()
            ).limit(limit + 1)

            result = await session.execute(stmt)
            rows: Sequence[T] = result.scalars().all()

            has_more = len(rows) > limit
            if has_more:
                rows = rows[:limit]

            next_cursor = None
            if rows and has_more:
                last = rows[-1]
                next_cursor = f"{last.updated_at.isoformat()}:{last.id}"

            return CursorPage(list(rows), next_cursor, has_more)

    async def get(self, farmer_id: UUID, id: UUID) -> T | None:
        """Get a single record, verifying farmer_id ownership."""
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = select(self.model).where(
                and_(
                    self.model.id == id,
                    self.model.farmer_id == farmer_id,
                    self.model.deleted_at.is_(None),
                )
            )
            result = await session.execute(stmt)
            return result.scalar_one_or_none()

    async def create(self, farmer_id: UUID, obj: T) -> T:
        """Create a new record for this farmer."""
        obj.farmer_id = farmer_id
        session_factory = get_session_factory()
        async with session_factory() as session:
            session.add(obj)
            await session.commit()
            await session.refresh(obj)
            return obj

    async def update(self, farmer_id: UUID, id: UUID, updates: dict[str, Any]) -> T | None:
        """Update a record, verifying farmer_id ownership."""
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = select(self.model).where(
                and_(
                    self.model.id == id,
                    self.model.farmer_id == farmer_id,
                    self.model.deleted_at.is_(None),
                )
            )
            result = await session.execute(stmt)
            obj = result.scalar_one_or_none()
            if not obj:
                return None

            for key, value in updates.items():
                if hasattr(obj, key) and key not in ("id", "farmer_id", "created_at"):
                    setattr(obj, key, value)

            await session.commit()
            await session.refresh(obj)
            return obj

    async def soft_delete(self, farmer_id: UUID, id: UUID) -> bool:
        """Soft-delete a record (idempotent)."""
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = select(self.model).where(
                and_(
                    self.model.id == id,
                    self.model.farmer_id == farmer_id,
                    self.model.deleted_at.is_(None),
                )
            )
            result = await session.execute(stmt)
            obj = result.scalar_one_or_none()
            if not obj:
                return False

            obj.deleted_at = datetime.now(datetime.now().astimezone().tzinfo)
            await session.commit()
            return True

    async def upsert(self, farmer_id: UUID, id: UUID, fields: dict[str, Any]) -> T:
        """Create-or-update by a client-minted primary key (idempotent sync push).

        A retried push batch upserts the same id twice and must be a no-op
        the second time (BACKEND_PLAN.md §8.2) — this is what makes that
        true. Raises `UpsertConflict` if `id` already belongs to a
        different farmer instead of silently adopting or overwriting it.
        """
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = select(self.model).where(self.model.id == id)
            result = await session.execute(stmt)
            obj = result.scalar_one_or_none()

            if obj is not None and obj.farmer_id != farmer_id:
                raise UpsertConflict(f"id {id} belongs to a different farmer")

            if obj is None:
                obj = self.model(id=id, farmer_id=farmer_id, **fields)
                session.add(obj)
            else:
                for key, value in fields.items():
                    if hasattr(obj, key) and key not in ("id", "farmer_id", "created_at"):
                        setattr(obj, key, value)

            await session.commit()
            await session.refresh(obj)
            return obj

    async def upsert_delete(self, farmer_id: UUID, id: UUID) -> None:
        """Soft-delete by client-minted id — idempotent even if already gone.

        Unlike `soft_delete`, a missing row is not an error: a sync push
        replaying a delete for a record the server has already tombstoned
        (or never saw, e.g. created-then-deleted entirely offline) must be
        a no-op, per BACKEND_PLAN.md §8.2's "retried batch is a no-op."
        """
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = select(self.model).where(self.model.id == id)
            result = await session.execute(stmt)
            obj = result.scalar_one_or_none()

            if obj is None:
                return
            if obj.farmer_id != farmer_id:
                raise UpsertConflict(f"id {id} belongs to a different farmer")
            if obj.deleted_at is None:
                obj.deleted_at = datetime.now(UTC)
                await session.commit()

    async def pull_since(
        self,
        farmer_id: UUID,
        since: datetime,
        cursor: str | None = None,
        limit: int = 200,
        until: datetime | None = None,
    ) -> CursorPage[T]:
        """Delta page of rows changed since `since`, tombstones included.

        Ascending over (updated_at, id) — the mirror image of `list()` —
        so a client can resume a partially-drained page with `cursor`
        without re-fetching rows it already applied, then advance its
        watermark to this pull's frozen `since`/`server_time` only once
        `has_more` is false (BACKEND_PLAN.md §8.2). Soft-deleted rows are
        deliberately not excluded: a tombstone is the whole point of a
        pull — a client offline when a delete happened has to learn about
        it somehow.

        `until` freezes the far edge of the window (the request's
        `server_time`) so a write landing between two pages of the same
        multi-page drain shows up on the *next* pull instead of shifting
        rows under an in-progress one.
        """
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = select(self.model).where(
                and_(
                    self.model.farmer_id == farmer_id,
                    self.model.updated_at > since,
                )
            )
            if until is not None:
                stmt = stmt.where(self.model.updated_at <= until)

            if cursor:
                updated_at_str, id_str = cursor.rsplit(":", 1)
                cursor_updated_at = datetime.fromisoformat(updated_at_str)
                cursor_id = UUID(id_str)
                stmt = stmt.where(
                    (self.model.updated_at > cursor_updated_at)
                    | (
                        (self.model.updated_at == cursor_updated_at)
                        & (self.model.id > cursor_id)
                    )
                )

            stmt = stmt.order_by(
                self.model.updated_at.asc(), self.model.id.asc()
            ).limit(limit + 1)

            result = await session.execute(stmt)
            rows: Sequence[T] = result.scalars().all()

            has_more = len(rows) > limit
            if has_more:
                rows = rows[:limit]

            next_cursor = None
            if rows and has_more:
                last = rows[-1]
                next_cursor = f"{last.updated_at.isoformat()}:{last.id}"

            return CursorPage(list(rows), next_cursor, has_more)
