"""Farmer assistant endpoints (#285).

Chat history (#286), question answering (#288) and the daily brief (added by
its own sub-issue) live here. The client appends every turn to the history
itself, so the logging flow (which never touches ``/ask``) persists the same
way as answers.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ValidationError
from sqlalchemy import delete, select

from myfarm_api.core import assistant_queries as queries
from myfarm_api.core.assistant import (
    AnswerOutput,
    RoutedMessage,
    Topic,
    build_answer_prompt,
    build_routing_prompt,
    fallback_answer,
    message,
    numbers_grounded,
    pick_language,
)
from myfarm_api.core.db import get_session_factory
from myfarm_api.core.llm import PROVIDER_UNAVAILABLE, LlmError, LlmProvider, get_llm_provider
from myfarm_api.models import ChatMessage, Farmer
from myfarm_api.routers.chat_entry import get_current_farmer
from myfarm_api.schemas.assistant import (
    AskRequest,
    AskResponse,
    ChatMessageRead,
    ChatMessagesAppend,
    ChatMessagesPage,
    Clarification,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/assistant", tags=["assistant"])

# Retention cap per farmer; the oldest messages are dropped first.
MAX_MESSAGES_PER_FARMER = 500


@router.get("/messages", response_model=ChatMessagesPage)
async def list_messages(
    limit: int = Query(50, ge=1, le=100),
    before: int | None = Query(None, description="Only messages with a lower id"),
    current_farmer: Farmer = Depends(get_current_farmer),
) -> ChatMessagesPage:
    """Newest-first page of the current farmer's chat history."""
    stmt = select(ChatMessage).where(ChatMessage.farmer_id == current_farmer.id)
    if before is not None:
        stmt = stmt.where(ChatMessage.id < before)
    # One extra row tells us whether an older page exists.
    stmt = stmt.order_by(ChatMessage.id.desc()).limit(limit + 1)

    session_factory = get_session_factory()
    async with session_factory() as session:
        rows = list((await session.execute(stmt)).scalars().all())

    return ChatMessagesPage(
        items=[ChatMessageRead.model_validate(r) for r in rows[:limit]],
        has_more=len(rows) > limit,
    )


@router.post("/messages", response_model=list[ChatMessageRead], status_code=201)
async def append_messages(
    payload: ChatMessagesAppend,
    current_farmer: Farmer = Depends(get_current_farmer),
) -> list[ChatMessageRead]:
    """Append one turn and trim the history to the retention cap."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        rows = [
            ChatMessage(farmer_id=current_farmer.id, **m.model_dump()) for m in payload.messages
        ]
        session.add_all(rows)
        await session.flush()

        # Trim in the same transaction as the insert, so the cap never lags.
        keep = (
            select(ChatMessage.id)
            .where(ChatMessage.farmer_id == current_farmer.id)
            .order_by(ChatMessage.id.desc())
            .limit(MAX_MESSAGES_PER_FARMER)
        )
        await session.execute(
            delete(ChatMessage).where(
                ChatMessage.farmer_id == current_farmer.id,
                ChatMessage.id.not_in(keep),
            )
        )
        await session.commit()
        for row in rows:
            await session.refresh(row)
        return [ChatMessageRead.model_validate(r) for r in rows]


@router.delete("/messages", status_code=204)
async def clear_messages(
    current_farmer: Farmer = Depends(get_current_farmer),
) -> None:
    """Delete the current farmer's whole chat history."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        await session.execute(delete(ChatMessage).where(ChatMessage.farmer_id == current_farmer.id))
        await session.commit()


# ------------------------------------------------------------------- ask

# Topics that read activities/expenses, and so can be narrowed by crop or land.
ACTIVITY_TOPICS: frozenset[str] = frozenset(
    {"spend", "spend_by_category", "recent_activities", "pending_activities"}
)


async def _complete[T: BaseModel](provider: LlmProvider, prompt: str, model: type[T]) -> T:
    """One provider call, validated. Any fault reads as 503 so the client falls back."""
    try:
        raw = await provider.complete_json(prompt)
    except LlmError as exc:
        raise HTTPException(status_code=503, detail=PROVIDER_UNAVAILABLE) from exc
    try:
        return model.model_validate(raw)
    except ValidationError as exc:
        # Keys and error shapes only — never the farmer's words or the facts.
        logger.warning(
            "assistant provider output failed validation; keys=%s errors=%s",
            sorted(raw.keys()),
            exc.errors(include_url=False, include_input=False),
        )
        raise HTTPException(status_code=503, detail=PROVIDER_UNAVAILABLE) from exc


@dataclass(frozen=True)
class Gathered:
    """Result of running a topic's query: facts, or a reason not to call the model."""

    data: dict[str, Any] | None = None
    text: str | None = None  # ready-made reply; skips the model
    clarification: Clarification | None = None


async def _gather(
    topic: Topic, farmer_id: int, scope: queries.Scope, land_id: int | None, language: str
) -> Gathered:
    empty = Gathered(text=message(language, "empty"))

    if topic == "spend":
        spend = await queries.spend(farmer_id, scope)
        return Gathered(data=spend) if spend["expense_count"] else empty
    if topic == "spend_by_category":
        rows = await queries.spend_by_category(farmer_id, scope)
        total = sum(r["total"] for r in rows)
        return Gathered(data={"items": rows, "total": total}) if rows else empty
    if topic in ("recent_activities", "pending_activities"):
        fetch = (
            queries.recent_activities
            if topic == "recent_activities"
            else queries.pending_activities
        )
        activities = await fetch(farmer_id, scope)
        return (
            Gathered(data={"items": activities, "count": len(activities)}) if activities else empty
        )
    if topic == "lands":
        lands = await queries.lands(farmer_id)
        return Gathered(data={"items": lands, "count": len(lands)}) if lands else empty
    if topic == "crops":
        crops = await queries.crops(farmer_id)
        return Gathered(data={"items": crops, "count": len(crops)}) if crops else empty

    weather = await queries.weather_for_land(farmer_id, land_id)
    if weather.status == "ok":
        return Gathered(data={"land": weather.land, "weather": weather.facts})
    if weather.status == "ambiguous":
        return Gathered(
            clarification=Clarification(
                field="land", reason="ambiguous", options=list(weather.options)
            )
        )
    key = "no_location" if weather.status == "no_location" else "weather_unavailable"
    return Gathered(text=message(language, key))


async def _resolve_scope(
    farmer_id: int, routed: RoutedMessage, today: date
) -> tuple[queries.Scope, int | None] | Clarification:
    """Turn the spoken crop/land/period into a scope, or ask which one is meant."""
    topic = routed.topic
    use_crop = bool(routed.crop) and topic in ACTIVITY_TOPICS
    use_land = bool(routed.land) and (topic in ACTIVITY_TOPICS or topic == "weather")

    crop_ids: tuple[int, ...] = ()
    land_id: int | None = None
    if use_crop or use_land:
        names = await queries.load_names(farmer_id)
        if use_crop and routed.crop:
            crop_match = queries.match_crops(names, routed.crop)
            if crop_match.kind != "matched":
                return Clarification(
                    field="crop", reason=crop_match.kind, options=list(crop_match.options)
                )
            crop_ids = crop_match.ids
        if use_land and routed.land:
            land_match = queries.match_land(names, routed.land)
            if land_match.kind != "matched":
                return Clarification(
                    field="land", reason=land_match.kind, options=list(land_match.options)
                )
            land_id = land_match.ids[0]

    start, end = queries.period_bounds(routed.period or "all", today)
    scope_land = land_id if topic in ACTIVITY_TOPICS else None
    return queries.Scope(crop_ids=crop_ids, land_id=scope_land, start=start, end=end), land_id


@router.post("/ask", response_model=AskResponse)
async def ask(
    payload: AskRequest,
    current_farmer: Farmer = Depends(get_current_farmer),
    provider: LlmProvider = Depends(get_llm_provider),
) -> AskResponse:
    """Route a fresh message and, for a question, answer it from the farmer's data.

    Persists nothing (the client appends turns to the history itself). Returns
    503 when the provider is unusable; the client then treats the message as a
    log entry and falls back to ``/activities/parse``.
    """
    language = pick_language(payload.language, current_farmer.preferred_language)
    today = datetime.now(UTC).date()

    routed = await _complete(
        provider,
        build_routing_prompt(text=payload.text, today=today, language=language),
        RoutedMessage,
    )
    # Intent and topic only: the message text is the farmer's own words.
    logger.info("assistant ask intent=%s topic=%s", routed.intent, routed.topic)

    if routed.intent == "log":
        return AskResponse(intent="log")
    if routed.intent == "unsupported" or routed.topic is None:
        return AskResponse(intent="unsupported")

    resolved = await _resolve_scope(current_farmer.id, routed, today)
    if isinstance(resolved, Clarification):
        return AskResponse(intent="question", needs_clarification=resolved)
    scope, land_id = resolved

    gathered = await _gather(routed.topic, current_farmer.id, scope, land_id, language)
    if gathered.clarification is not None:
        return AskResponse(intent="question", needs_clarification=gathered.clarification)
    if gathered.text is not None or gathered.data is None:
        return AskResponse(intent="question", answer=gathered.text or message(language, "empty"))

    facts = {
        "topic": routed.topic,
        "scope": {
            "crop": routed.crop,
            "land": routed.land,
            "period": routed.period or "all",
            "from": scope.start,
            "to": scope.end,
        },
        "data": gathered.data,
    }
    answer = await _complete(
        provider,
        build_answer_prompt(question=payload.text, facts=facts, language=language),
        AnswerOutput,
    )
    text = answer.answer.strip()
    if not text or not numbers_grounded(text, facts):
        # The wording cited a figure the backend never computed: show the
        # facts plainly instead of a number we cannot vouch for.
        logger.warning(
            "assistant answer not grounded in facts; using fallback topic=%s", routed.topic
        )
        text = fallback_answer(routed.topic, facts, language)
    return AskResponse(intent="question", answer=text)
