"""Offline sync endpoints (BACKEND_PLAN.md §7-8): a per-item-idempotent
push for the client's IndexedDB outbox, and a tombstone-including delta
pull for reconciling state the client missed while offline.

Scope: the four top-level farmer-owned entities that carry their own
`farmer_id` (farms, lands, crops, activities) — the ones an offline
farmer actually creates/edits/deletes in the field. `activity_expense`
and `activity_attachment` have no `farmer_id` of their own (tenancy flows
through `activity_id` -> `activity.farmer_id`, see
repositories/entities.py) and stay on their existing online-only nested
endpoints for now; attachments in particular are Stage 7's job once R2
upload is wired up.
"""

import base64
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ValidationError

from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import Farmer
from myfarm_api.repositories.crud import TenantScopedCRUD, UpsertConflict
from myfarm_api.repositories.entities import (
    activity_repo,
    crop_repo,
    farm_repo,
    land_repo,
)
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.activity import ActivityCreate, ActivityRead, ActivityUpdate
from myfarm_api.schemas.crop import CropCreate, CropRead, CropUpdate
from myfarm_api.schemas.farm import FarmCreate, FarmRead, FarmUpdate
from myfarm_api.schemas.land import LandCreate, LandRead, LandUpdate
from myfarm_api.schemas.sync import (
    SyncPullResponse,
    SyncPushItem,
    SyncPushRequest,
    SyncPushResponse,
    SyncPushResultItem,
)

router = APIRouter(prefix="/api/v1/sync", tags=["sync"])

EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> Farmer:
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


@dataclass(frozen=True)
class EntityConfig:
    repo: TenantScopedCRUD[Any]
    create_schema: type[BaseModel]
    update_schema: type[BaseModel]
    read_schema: type[BaseModel]


ENTITY_REGISTRY: dict[str, EntityConfig] = {
    "farms": EntityConfig(farm_repo, FarmCreate, FarmUpdate, FarmRead),
    "lands": EntityConfig(land_repo, LandCreate, LandUpdate, LandRead),
    "crops": EntityConfig(crop_repo, CropCreate, CropUpdate, CropRead),
    "activities": EntityConfig(activity_repo, ActivityCreate, ActivityUpdate, ActivityRead),
}


def _encode_cursor(state: dict[str, Any]) -> str:
    return base64.urlsafe_b64encode(json.dumps(state).encode()).decode()


def _decode_cursor(cursor: str) -> dict[str, Any]:
    decoded: dict[str, Any] = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
    return decoded


async def _apply_push_item(farmer_id: UUID, item: SyncPushItem) -> SyncPushResultItem:
    config = ENTITY_REGISTRY[item.entity_type]

    try:
        if item.operation == "delete":
            await config.repo.upsert_delete(farmer_id, item.id)
            return SyncPushResultItem(
                entity_type=item.entity_type,
                id=item.id,
                operation=item.operation,
                status="ok",
            )

        schema = config.create_schema if item.operation == "create" else config.update_schema
        try:
            validated = schema.model_validate(item.payload)
        except ValidationError as exc:
            return SyncPushResultItem(
                entity_type=item.entity_type,
                id=item.id,
                operation=item.operation,
                status="error",
                error_code="validation_error",
                message=str(exc),
            )

        fields = validated.model_dump(exclude_unset=(item.operation == "update"))
        obj = await config.repo.upsert(farmer_id, item.id, fields)
        return SyncPushResultItem(
            entity_type=item.entity_type,
            id=item.id,
            operation=item.operation,
            status="ok",
            entity=config.read_schema.model_validate(obj).model_dump(mode="json"),
        )
    except UpsertConflict as exc:
        return SyncPushResultItem(
            entity_type=item.entity_type,
            id=item.id,
            operation=item.operation,
            status="error",
            error_code="conflict",
            message=str(exc),
        )


@router.post("/push", response_model=SyncPushResponse)
async def push(
    data: SyncPushRequest,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> SyncPushResponse:
    """Drain a batch of outbox mutations. Per-item results: one bad item
    (a stale FK, a conflicting id) never fails the rest of the batch, and
    replaying the same batch again changes nothing (idempotent upsert by
    the client-minted id)."""
    results = [await _apply_push_item(current_farmer.id, item) for item in data.operations]
    return SyncPushResponse(results=results)


@router.get("/pull", response_model=SyncPullResponse)
async def pull(
    current_farmer: Farmer = Depends(get_current_farmer),
    since: datetime | None = Query(None),
    cursor: str | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
) -> SyncPullResponse:
    """Delta pull since a watermark, tombstones included, per entity type.

    First call: pass `since` (omit for a full pull). If the response's
    `next_cursor` is set, at least one entity type had more than `limit`
    rows in this window — call again with that `cursor` (keep `since` as
    sent, it's ignored once a cursor is present) until `next_cursor` comes
    back null, then store the response's `server_time` as the new `since`
    watermark for the next pull.
    """
    if cursor:
        state = _decode_cursor(cursor)
        effective_since = datetime.fromisoformat(state["since"])
        server_time = datetime.fromisoformat(state["server_time"])
        positions: dict[str, str | None] = state["positions"]
    else:
        effective_since = since or EPOCH
        server_time = datetime.now(UTC)
        positions = dict.fromkeys(ENTITY_REGISTRY)

    entities: dict[str, dict[str, Any]] = {}
    new_positions = dict(positions)
    any_more = False

    for name, config in ENTITY_REGISTRY.items():
        page = await config.repo.pull_since(
            current_farmer.id,
            effective_since,
            cursor=positions.get(name),
            limit=limit,
            until=server_time,
        )
        entities[name] = {
            "items": [
                config.read_schema.model_validate(row).model_dump(mode="json")
                for row in page.items
            ],
            "has_more": page.has_more,
        }
        if page.has_more:
            any_more = True
            new_positions[name] = page.next_cursor

    next_cursor = None
    if any_more:
        next_cursor = _encode_cursor(
            {
                "since": effective_since.isoformat(),
                "server_time": server_time.isoformat(),
                "positions": new_positions,
            }
        )

    return SyncPullResponse(
        entities=entities,  # type: ignore[arg-type]
        next_cursor=next_cursor,
        server_time=server_time,
    )
