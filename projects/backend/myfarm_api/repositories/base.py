import base64
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any, Protocol, runtime_checkable

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession


@runtime_checkable
class FarmerOwnedRecord(Protocol):
    """The columns every farmer-owned table has (BACKEND_PLAN.md §6.3)."""

    id: Any
    farmer_id: Any
    updated_at: datetime
    deleted_at: datetime | None


def encode_cursor(updated_at: datetime, id_: Any) -> str:
    raw = f"{updated_at.isoformat()}|{id_}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        ts, id_ = raw.split("|", 1)
        return datetime.fromisoformat(ts), id_
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError("Malformed pagination cursor") from exc


class NotOwnedError(ValueError):
    """Raised when a write would create or move a row into another farmer's
    tenant — the belt to RLS's suspenders (BACKEND_PLAN.md §5.2)."""


class TenantScopedRepository[ModelType: FarmerOwnedRecord]:
    """Base for every farmer-owned table's repository.

    Cannot be constructed without a `farmer_id`, and every method applies it
    automatically — a router can never accidentally cross tenants because it
    forgot a `WHERE` clause. This is layer 1 of the three that replace what
    Firestore security rules used to guarantee at the database
    (BACKEND_PLAN.md §5.2); Postgres Row-Level Security (`set_rls_farmer` in
    `core/db.py`) is layer 2, and a cross-tenant test per endpoint is layer 3.

    Subclasses set `model` to their SQLAlchemy class and may add
    entity-specific queries, but should never bypass `_base_query`.
    """

    model: type[ModelType]

    def __init__(self, session: AsyncSession, farmer_id: Any) -> None:
        if not farmer_id:
            raise ValueError("TenantScopedRepository requires a farmer_id")
        self.session = session
        self.farmer_id = farmer_id

    @property
    def _m(self) -> Any:
        """`self.model` for query-building.

        A declarative class is dual-natured: at the *instance* level its
        columns are plain values (what `FarmerOwnedRecord` describes), but
        at the *class* level — which is what every query below actually
        touches — the same names are SQLAlchemy `InstrumentedAttribute`s
        with comparison and query-building methods (`.is_()`, `.asc()`, ...).
        A `Protocol` can only describe one of those, and it has to be the
        instance side since that's what `create`/`update`/`soft_delete`
        touch. This property is the one place that switches views, so the
        gap doesn't have to be papered over at every call site.
        """
        return self.model

    def _base_query(self) -> Any:
        return select(self.model).where(
            self._m.farmer_id == self.farmer_id,
            self._m.deleted_at.is_(None),
        )

    async def list(
        self, *, limit: int = 50, cursor: str | None = None
    ) -> tuple[Sequence[ModelType], str | None]:
        limit = max(1, min(limit, 200))
        query = self._base_query().order_by(self._m.updated_at.asc(), self._m.id.asc())
        if cursor:
            after_updated_at, after_id = decode_cursor(cursor)
            query = query.where(
                or_(
                    self._m.updated_at > after_updated_at,
                    and_(
                        self._m.updated_at == after_updated_at,
                        self._m.id > after_id,
                    ),
                )
            )
        query = query.limit(limit + 1)

        rows = list((await self.session.execute(query)).scalars().all())
        next_cursor = None
        if len(rows) > limit:
            rows = rows[:limit]
            last = rows[-1]
            next_cursor = encode_cursor(last.updated_at, last.id)
        return rows, next_cursor

    async def get(self, id_: Any) -> ModelType | None:
        query = self._base_query().where(self._m.id == id_)
        return (await self.session.execute(query)).scalar_one_or_none()

    async def create(self, obj: ModelType) -> ModelType:
        if obj.farmer_id != self.farmer_id:
            raise NotOwnedError(
                f"Cannot create a {type(obj).__name__} row for another farmer"
            )
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def update(self, id_: Any, **values: Any) -> ModelType | None:
        # farmer_id and id are identity, not data — a caller can never move a
        # row to another tenant or change its key through this method.
        values.pop("farmer_id", None)
        values.pop("id", None)

        obj = await self.get(id_)
        if obj is None:
            return None
        for key, value in values.items():
            setattr(obj, key, value)
        obj.updated_at = datetime.now(UTC)
        await self.session.flush()
        return obj

    async def soft_delete(self, id_: Any) -> bool:
        obj = await self.get(id_)
        if obj is None:
            return False
        now = datetime.now(UTC)
        obj.deleted_at = now
        obj.updated_at = now
        await self.session.flush()
        return True
