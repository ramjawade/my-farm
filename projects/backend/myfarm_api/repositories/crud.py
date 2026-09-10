"""Generic CRUD repository for tenant-scoped entities with cursor pagination."""

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select

from myfarm_api.core.db import get_session_factory
from myfarm_api.models import TenantScopedBase


class CursorPage[T]:
    """Cursor-paginated result set."""

    def __init__(
        self, items: list[T], next_cursor: str | None = None, has_more: bool = False
    ) -> None:
        self.items = items
        self.next_cursor = next_cursor
        self.has_more = has_more


class TenantScopedCRUD[T: TenantScopedBase]:
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

    async def list_all(self, farmer_id: UUID) -> list[T]:
        """List all non-deleted records for this farmer (no pagination)."""
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = select(self.model).where(
                and_(
                    self.model.farmer_id == farmer_id,
                    self.model.deleted_at.is_(None),
                )
            ).order_by(self.model.updated_at.desc(), self.model.id.desc())

            result = await session.execute(stmt)
            return list(result.scalars().all())

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
