"""Ownership checks for foreign keys supplied in a request payload (#246).

`TenantScopedCRUD` scopes the row being written to the caller: it sets
``farmer_id`` on create and filters on it for reads and updates. It cannot
vouch for ids the caller puts *inside* the payload — a `land_id` in the body
is just an integer until someone checks who owns it.

Postgres RLS does not apply on Neon's hosted roles (BACKEND_PLAN.md §11), so
these checks are the only tenant boundary on the write path. Any endpoint
accepting a foreign key to a farmer-owned table must call
:func:`ensure_owned` for it.
"""

from fastapi import HTTPException

from myfarm_api.models import TenantScopedBase
from myfarm_api.repositories.crud import TenantScopedCRUD


async def ensure_owned[T: TenantScopedBase](
    repo: TenantScopedCRUD[T],
    farmer_id: int,
    entity_id: int | None,
    label: str,
) -> None:
    """404 unless ``entity_id`` belongs to ``farmer_id``.

    ``None`` passes: an absent optional reference is not a tenancy problem.

    404 rather than 403 matches the convention used everywhere else in this
    API — a farmer must not be able to tell the difference between "this id
    belongs to someone else" and "this id does not exist", since that
    distinction is itself a disclosure about another tenant's data.
    """
    if entity_id is None:
        return
    if await repo.get(farmer_id, entity_id) is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
