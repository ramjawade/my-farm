"""Test environment must be set before `myfarm_api` is imported anywhere —
`Settings` reads os.environ at construction and `get_settings()` is cached.
"""

import os
import subprocess
import sys

os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/myfarm_test"
)
os.environ.setdefault("FIREBASE_PROJECT_ID", "myfarm-test")
os.environ.setdefault("CORS_ORIGINS", "https://ramjawade.github.io")
os.environ.setdefault("SESSION_JWT_SECRET", "test-session-secret")

from collections.abc import AsyncIterator  # noqa: E402
from pathlib import Path  # noqa: E402
from uuid import uuid4  # noqa: E402

import pytest  # noqa: E402
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
from myfarm_api.models import ActivityType, CropCatalog, ExpenseCategory  # noqa: E402

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


_BACKEND_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session", autouse=True)
def _apply_migrations() -> None:
    """Bring the test database to head before anything runs.

    Nothing else creates the real schema — the app's tables only exist as
    Alembic migrations — so without this every DB-backed test fails with
    `relation "farmer" does not exist`. `alembic upgrade head` is
    idempotent, and a subprocess sidesteps env.py's own `asyncio.run()`
    clashing with the pytest-asyncio session loop.
    """
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=_BACKEND_ROOT,
        check=True,
        env=os.environ,
    )


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


@pytest_asyncio.fixture
async def reference_ids() -> dict[str, str]:
    """Real reference-table rows for tests that create crops/activities/expenses.

    Those tables carry real foreign keys to crop_catalog/activity_type/
    expense_category, so a random uuid4() for those ids 404s at the database
    with a ForeignKeyViolationError. Each row gets a unique name per call so
    parallel tests never collide on the UNIQUE(name) constraint.
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        suffix = uuid4()
        crop = CropCatalog(name=f"TestCrop-{suffix}")
        expense = ExpenseCategory(name=f"TestExpense-{suffix}")
        activity_type = ActivityType(name=f"TestActivityType-{suffix}")
        session.add_all([crop, expense, activity_type])
        await session.commit()
        return {
            "crop_catalog_id": str(crop.id),
            "expense_category_id": str(expense.id),
            "activity_type_id": str(activity_type.id),
        }
