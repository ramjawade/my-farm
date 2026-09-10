"""Generic CRUD repository for tenant-scoped, farmer-owned entities.

Lists are unpaginated — one call returns every non-deleted row for the
farmer (#61). Cursor pagination is tracked for a later reintroduction in
#62; the previous implementation is in git history.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select

from myfarm_api.core.db import get_session_factory
from myfarm_api.models import TenantScopedBase


class TenantScopedCRUD[T: TenantScopedBase]:
    """Generic CRUD for farmer-owned entities, scoped to one `farmer_id`."""

    def __init__(self, model: type[T]) -> None:
        self.model = model

    async def list_all(self, farmer_id: UUID) -> list[T]:
        """Every non-deleted record for this farmer, newest first."""
        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = (
                select(self.model)
                .where(
                    and_(
                        self.model.farmer_id == farmer_id,
                        self.model.deleted_at.is_(None),
                    )
                )
                .order_by(self.model.updated_at.desc(), self.model.id.desc())
            )

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
