"""Natural-language entry parsing (#241, #242).

Takes plain-language text and returns a structured entry carrying **database
ids**, ready for #243 to show the farmer and post to the existing activity
endpoint. Persists nothing: this endpoint is extraction and resolution only,
so it can be exercised, measured and tuned without writing a single row.

Three outcomes the client must tell apart:

* **200** — an entry, possibly with fields dropped and reported in `dropped`.
* **422** — the text carried no usable activity; ask the farmer to rephrase.
* **503** — the provider is unusable; fall back to the manual form.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from myfarm_api.core.chat_entry import build_prompt
from myfarm_api.core.config import get_settings
from myfarm_api.core.entry_resolver import (
    UnresolvableActivityType,
    load_context,
    resolve_entry,
)
from myfarm_api.core.llm import (
    PROVIDER_UNAVAILABLE,
    LlmError,
    LlmProvider,
    get_llm_provider,
)
from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.models import Farmer
from myfarm_api.repositories.farmer import FarmerRepository
from myfarm_api.schemas.chat_entry import ChatParseRequest, ChatParseResponse, ParsedEntry

router = APIRouter(prefix="/api/v1/activities", tags=["chat-entry"])

# 422, not 503: the provider worked, we just could not extract a usable
# activity. The client asks the farmer to rephrase rather than declaring the
# feature broken and falling back to the form.
NOT_UNDERSTOOD = "Could not tell what activity that describes. Try rephrasing, or use the form."


async def get_current_farmer(
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> Farmer:
    """Get the current farmer, provisioning if needed."""
    return await FarmerRepository.get_or_create(identity.uid)


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
    # One read of the reference tables serves both the prompt's permitted
    # values and the resolver's accepted values, so the two cannot disagree.
    context = await load_context(current_farmer.id)
    if not context.activity_type_names or not context.expense_category_names:
        # Reference data missing means any output would be rejected anyway.
        raise HTTPException(status_code=503, detail=PROVIDER_UNAVAILABLE)

    prompt = build_prompt(
        text=payload.text,
        activity_types=context.activity_type_names,
        expense_categories=context.expense_category_names,
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
        # Shape validation. A response that does not fit the schema is a
        # provider problem, not the farmer's, so it reads as 503 and the
        # client falls back to the form.
        raise HTTPException(status_code=503, detail=PROVIDER_UNAVAILABLE) from exc

    # Semantic validation: names become ids, or are refused. Server-side,
    # because the crop/land checks are a tenant boundary and a client-side
    # check is not a boundary at all (#246 hardens the save path for the
    # same reason).
    try:
        resolved = resolve_entry(parsed, context)
    except UnresolvableActivityType as exc:
        # 422, not 503: the provider worked, we simply could not extract a
        # usable activity. The client should ask the farmer to rephrase
        # rather than declare the feature broken.
        raise HTTPException(status_code=422, detail=NOT_UNDERSTOOD) from exc

    return ChatParseResponse(parsed=resolved, model=get_settings().gemini_model)
