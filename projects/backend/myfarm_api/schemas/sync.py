"""Pydantic schemas for the offline sync protocol (BACKEND_PLAN.md §8.2)."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel

SyncOperation = Literal["create", "update", "delete"]

SYNC_ENTITY_TYPES = ("farms", "lands", "crops", "activities")
SyncEntityType = Literal["farms", "lands", "crops", "activities"]


class SyncPushItem(BaseModel):
    """One outbox mutation. `id` is the client-minted UUIDv7 — the server
    upserts by this primary key, so replaying the same item is a no-op."""

    entity_type: SyncEntityType
    id: UUID
    operation: SyncOperation
    payload: dict[str, Any] = {}


class SyncPushRequest(BaseModel):
    """A batch of outbox mutations, possibly spanning entity types."""

    operations: list[SyncPushItem]


class SyncPushResultItem(BaseModel):
    """Per-item result — one bad item never fails the rest of the batch."""

    entity_type: SyncEntityType
    id: UUID
    operation: SyncOperation
    status: Literal["ok", "error"]
    entity: dict[str, Any] | None = None
    error_code: str | None = None
    message: str | None = None


class SyncPushResponse(BaseModel):
    results: list[SyncPushResultItem]


class SyncEntityPage(BaseModel):
    """One entity type's slice of a pull response."""

    items: list[dict[str, Any]]
    has_more: bool


class SyncPullResponse(BaseModel):
    """Delta since a watermark, per entity type, tombstones included.

    `next_cursor` is set only while any entity type still has more of the
    current window to drain; once it's null the client stores
    `server_time` as its new watermark for the next pull's `since`.
    """

    entities: dict[str, SyncEntityPage]
    next_cursor: str | None = None
    server_time: datetime
