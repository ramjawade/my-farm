"""Pydantic schemas for the farmer assistant (#285)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ChatRole = Literal["farmer", "bot"]
ChatKind = Literal["text", "brief", "answer"]


class ChatMessageCreate(BaseModel):
    """One message to append to the farmer's history."""

    role: ChatRole
    kind: ChatKind = "text"
    text: str = Field(..., min_length=1, max_length=4000)


class ChatMessagesAppend(BaseModel):
    """A turn is a farmer message and/or the bot reply, so 1–2 at a time."""

    messages: list[ChatMessageCreate] = Field(..., min_length=1, max_length=2)


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: ChatRole
    kind: ChatKind
    text: str
    created_at: datetime


class ChatMessagesPage(BaseModel):
    """Newest-first page; pass the last `id` as `before` for older messages."""

    items: list[ChatMessageRead]
    has_more: bool
