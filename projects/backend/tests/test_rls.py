"""Proves Postgres Row-Level Security actually enforces tenant isolation —
independent of, and unaware of, the application-level filter in
`TenantScopedRepository`. Every query here has no `WHERE` clause at all;
if RLS didn't work, every row would come back.

Runs as the `myfarm_app` role, never as the connecting superuser: Postgres
superusers (and anything with BYPASSRLS) bypass Row-Level Security
unconditionally, with or without `FORCE ROW LEVEL SECURITY` — a test that
ran as `postgres` would pass whether or not the policy did anything at all.
"""

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from myfarm_api.core.db import set_rls_farmer

TABLE = "_test_rls_widgets"


@pytest_asyncio.fixture(autouse=True)
async def _rls_table_and_role(superuser_engine: AsyncEngine) -> AsyncIterator[None]:
    async with superuser_engine.begin() as conn:
        await conn.execute(
            text(
                "DO $$ BEGIN "
                "IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'myfarm_app') THEN "
                "CREATE ROLE myfarm_app LOGIN PASSWORD 'myfarm_app' NOSUPERUSER NOBYPASSRLS; "
                "END IF; END $$;"
            )
        )
        await conn.execute(text(f"DROP TABLE IF EXISTS {TABLE}"))
        await conn.execute(
            text(
                f"CREATE TABLE {TABLE} "
                "(id text primary key, farmer_id text not null, name text not null)"
            )
        )
        await conn.execute(text(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY"))
        await conn.execute(text(f"ALTER TABLE {TABLE} FORCE ROW LEVEL SECURITY"))
        await conn.execute(
            text(
                f"CREATE POLICY tenant_isolation ON {TABLE} "
                "USING (farmer_id = current_setting('app.current_farmer_id', true)) "
                "WITH CHECK (farmer_id = current_setting('app.current_farmer_id', true))"
            )
        )
        await conn.execute(text(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {TABLE} TO myfarm_app"))
        await conn.execute(
            text(
                f"INSERT INTO {TABLE} (id, farmer_id, name) VALUES "
                "('r1', 'farmer-a', 'Alpha'), ('r2', 'farmer-b', 'Bravo')"
            )
        )
    yield
    async with superuser_engine.begin() as conn:
        await conn.execute(text(f"DROP TABLE IF EXISTS {TABLE}"))


async def test_no_session_variable_set_returns_nothing(app_role_session: AsyncSession) -> None:
    # No WHERE clause — the point is that RLS default-denies even when the
    # app forgot the tenant filter entirely.
    rows = (await app_role_session.execute(text(f"SELECT id FROM {TABLE}"))).all()
    assert rows == []


async def test_session_variable_scopes_every_row_returned(app_role_session: AsyncSession) -> None:
    await set_rls_farmer(app_role_session, "farmer-a")
    rows = (await app_role_session.execute(text(f"SELECT id, farmer_id FROM {TABLE}"))).all()
    assert [r.id for r in rows] == ["r1"]


async def test_different_farmer_sees_only_their_own_row(app_role_session: AsyncSession) -> None:
    await set_rls_farmer(app_role_session, "farmer-b")
    rows = (await app_role_session.execute(text(f"SELECT id FROM {TABLE}"))).all()
    assert [r.id for r in rows] == ["r2"]


async def test_session_variable_is_transaction_local(app_role_session: AsyncSession) -> None:
    """`set_config(..., true)` clears at transaction end, matching `SET
    LOCAL` — a pooled connection can never leak one request's farmer_id into
    the next request that reuses it."""
    await set_rls_farmer(app_role_session, "farmer-a")
    rows = (await app_role_session.execute(text(f"SELECT id FROM {TABLE}"))).all()
    assert [r.id for r in rows] == ["r1"]

    await app_role_session.commit()  # ends the transaction the setting was local to

    rows_after = (await app_role_session.execute(text(f"SELECT id FROM {TABLE}"))).all()
    assert rows_after == []  # scope reset — no session variable is set anymore


async def test_insert_for_another_farmer_is_rejected_by_the_policy(
    app_role_session: AsyncSession,
) -> None:
    await set_rls_farmer(app_role_session, "farmer-a")
    with pytest.raises(DBAPIError):
        await app_role_session.execute(
            text(f"INSERT INTO {TABLE} (id, farmer_id, name) VALUES ('r3', 'farmer-b', 'Hijack')")
        )
