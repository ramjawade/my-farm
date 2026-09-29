"""Farmer assistant endpoints (#285).

Chat history (#286) lives here; question answering and the daily brief are
added by their own sub-issues. The client appends every turn itself, so the
logging flow (which never touches the assistant endpoints) persists the same
way as answers.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, select

from myfarm_api.core.db import get_session_factory
from myfarm_api.models import ChatMessage, Farmer
from myfarm_api.routers.chat_entry import get_current_farmer
from myfarm_api.schemas.assistant import (
    ChatMessageRead,
    ChatMessagesAppend,
    ChatMessagesPage,
)

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
