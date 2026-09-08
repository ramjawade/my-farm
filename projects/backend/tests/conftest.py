"""Test environment must be set before `myfarm_api` is imported anywhere —
`Settings` reads os.environ at construction and `get_settings()` is cached.
"""

import os

os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/myfarm_test"
)
os.environ.setdefault("FIREBASE_PROJECT_ID", "myfarm-test")
os.environ.setdefault("CORS_ORIGINS", "https://ramjawade.github.io")

from collections.abc import AsyncIterator  # noqa: E402

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from myfarm_api.core.db import get_session_factory  # noqa: E402
from myfarm_api.main import app  # noqa: E402

TEST_PROJECT_ID = "myfarm-test"

# The superuser connection test fixtures provision with (create/drop tables,
# create the app role). Never used to prove RLS — see test_rls.py for why
# that would be a false positive.
SUPERUSER_DATABASE_URL = os.environ["DATABASE_URL"]

# A real, non-superuser role. Postgres superusers bypass Row-Level Security
# unconditionally, with or without FORCE ROW LEVEL SECURITY, so any RLS test
# run as `postgres` would pass regardless of whether the policy works.
APP_ROLE_DATABASE_URL = "postgresql+asyncpg://myfarm_app:myfarm_app@localhost:5432/myfarm_test"

# Engines are session-scoped and created exactly once, same as the app's own
# module-level cache in core/db.py (see pyproject.toml's
# asyncio_default_fixture_loop_scope = "session"). Repeatedly creating and
# disposing AsyncEngine objects across tests is what actually produces
# "Event loop is closed" / "manually started transaction" errors — a fresh
# engine per test doesn't match how asyncpg connections or the real app's
# process-lifetime engine behave.


@pytest_asyncio.fixture(scope="session")
async def superuser_engine() -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(SUPERUSER_DATABASE_URL)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def app_role_engine() -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(APP_ROLE_DATABASE_URL)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    async with get_session_factory()() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def app_role_session(app_role_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    factory = async_sessionmaker(app_role_engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
