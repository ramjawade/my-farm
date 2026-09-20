"""Natural-language entry parsing (#241).

Takes plain-language text and returns a structured entry as **names**, ready
for #242 to resolve into ids and #243 to show the farmer. Persists nothing:
this endpoint is pure extraction, so it can be exercised, measured and tuned
without writing a single activity row.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import select

from myfarm_api.core.chat_entry import build_prompt
from myfarm_api.core.config import get_settings
from myfarm_api.core.db import get_session_factory
from myfarm_api.core.llm import (
    PROVIDER_UNAVAILABLE,
    LlmError,
    LlmProvider,
    get_llm_provider,
)
from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import ActivityType, ExpenseCategory, Farmer
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.chat_entry import ChatParseRequest, ChatParseResponse, ParsedEntry

router = APIRouter(prefix="/api/v1/activities", tags=["chat-entry"])


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> Farmer:
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


async def _load_vocabulary() -> tuple[list[str], list[str]]:
    """Read the permitted activity types and expense categories.

    From the database, never a constant in this file: the prompt's allowed
    values and the reference tables must be the same list or #242 will reject
    output this endpoint considered fine.
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        types = await session.execute(select(ActivityType.name).order_by(ActivityType.name))
        categories = await session.execute(
            select(ExpenseCategory.name).order_by(ExpenseCategory.name)
        )
        return list(types.scalars().all()), list(categories.scalars().all())


@router.post("/parse", response_model=ChatParseResponse)
async def parse_entry(
    payload: ChatParseRequest,
    current_farmer: Farmer = Depends(get_current_farmer),
    provider: LlmProvider = Depends(get_llm_provider),
) -> ChatParseResponse:
    """Parse plain-language text into a structured entry. Persists nothing.

    Returns 503 when the provider is unusable — that is the signal for the
    client to fall back to the manual form. Manual entry is never blocked by
    this endpoint being down.
    """
    activity_types, expense_categories = await _load_vocabulary()
    if not activity_types or not expense_categories:
        # Reference data missing means any output would fail #242's checks.
        raise HTTPException(status_code=503, detail=PROVIDER_UNAVAILABLE)

    prompt = build_prompt(
        text=payload.text,
        activity_types=activity_types,
        expense_categories=expense_categories,
        today=datetime.now(UTC).date(),
        language=payload.language or current_farmer.preferred_language or "en",
    )

    try:
        raw = await provider.complete_json(prompt)
    except LlmError as exc:
        raise HTTPException(status_code=503, detail=PROVIDER_UNAVAILABLE) from exc

    try:
        parsed = ParsedEntry.model_validate(raw)
    except ValidationError as exc:
        # Shape validation only. Whether the *values* are real — a known
        # activity type, a crop this farmer owns — is #242's decision, and
        # splitting it that way keeps each half independently testable.
        raise HTTPException(status_code=503, detail=PROVIDER_UNAVAILABLE) from exc

    return ChatParseResponse(parsed=parsed, model=get_settings().gemini_model)
