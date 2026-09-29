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


class AskRequest(BaseModel):
    """A fresh message from the farmer (not an answer to a clarification)."""

    text: str = Field(min_length=1, max_length=2000)
    language: str | None = Field(
        default=None,
        description="'en', 'hi' or 'mr'. Falls back to the farmer's preferred_language.",
    )


class Clarification(BaseModel):
    """The bot needs the farmer to pick a crop or land.

    ``options`` are the farmer's own names, ready to show as quick replies.
    ``reason`` lets the client word it: unknown ("couldn't find X") versus
    ambiguous ("which X?").
    """

    field: Literal["crop", "land"]
    reason: Literal["unknown", "ambiguous"]
    options: list[str]


class AskResponse(BaseModel):
    """How to handle the message.

    * ``log`` — continue with ``POST /activities/parse``; nothing else is set.
    * ``unsupported`` — show the fixed help message; nothing else is set.
    * ``question`` — exactly one of ``answer`` or ``needs_clarification``.
    """

    intent: Literal["log", "question", "unsupported"]
    answer: str | None = None
    needs_clarification: Clarification | None = None


class BriefWeather(BaseModel):
    land: str
    temp_c: float | None = None
    description: str | None = None
    humidity_pct: float | None = None
    source: str = Field(description="'live', 'cached' or 'mock' (mock means not live data).")


class BriefActivity(BaseModel):
    activity: str
    date: str | None = None
    land: str | None = None
    crop: str | None = None
    status: str


class BriefPending(BaseModel):
    count: int = Field(description="All pending activities; `next` is only the soonest few.")
    next: list[BriefActivity]


class BriefSpend(BaseModel):
    total: float


class BriefResponse(BaseModel):
    """Structured daily brief. Every section is omitted when there is no data for it.

    Carries data, not text: the client renders it from its own translations, so
    the brief works in every language and while the model provider is down.
    ``has_data`` false means "show the welcome instead".
    """

    has_data: bool
    name: str | None = Field(default=None, description="The farmer's full name, for the greeting.")
    weather: BriefWeather | None = None
    pending: BriefPending | None = None
    spend_7d: BriefSpend | None = None


class ChatMessagesPage(BaseModel):
    """Newest-first page; pass the last `id` as `before` for older messages."""

    items: list[ChatMessageRead]
    has_more: bool
