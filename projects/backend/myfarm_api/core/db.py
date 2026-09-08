from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from myfarm_api.core.config import get_settings


class Base(DeclarativeBase):
    """Shared declarative base for every table. Stage 3's `models/` package
    defines the tables themselves; this only exists so they share one
    metadata object for Alembic to introspect.
    """


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        settings = get_settings()
        # Sized for Neon's pooled endpoint against a 0.1-CPU Render instance
        # (BACKEND_PLAN.md §4): a handful of connections, no overflow, and
        # pre-ping so a connection dropped while Neon scaled to zero doesn't
        # surface as a query error.
        _engine = create_async_engine(
            settings.database_url,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_pre_ping=True,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(), expire_on_commit=False, class_=AsyncSession
        )
    return _session_factory


async def get_db() -> AsyncIterator[AsyncSession]:
    """Per-request session. Commits on clean exit, rolls back on error —
    routers never call commit()/rollback() themselves.
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def set_rls_farmer(session: AsyncSession, farmer_id: str) -> None:
    """Scope every query in this transaction to one farmer at the database
    level — Postgres Row-Level Security, layer 2 of the three that replace
    what Firestore rules used to guarantee (BACKEND_PLAN.md §5.2).

    `set_config(..., true)` is transaction-local (`SET LOCAL` semantics), so
    a connection returned to the pool can never leak one request's farmer_id
    into the next request that reuses it.
    """
    await session.execute(
        text("SELECT set_config('app.current_farmer_id', :fid, true)"), {"fid": farmer_id}
    )
