"""Model-provider seam for natural-language entry parsing (#241).

Everything model-specific lives behind :class:`LlmProvider`. The router and
the prompt builder never import a provider directly, so swapping Gemini for
another provider — or, per #232, for one that accepts audio instead of text —
is a change to this module alone.

The API key is read from settings and stays server-side. It is never returned
in a response and never reaches the client.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Protocol

import httpx
from fastapi import HTTPException

from myfarm_api.core.config import get_settings

logger = logging.getLogger(__name__)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# Extraction, not reasoning: the vocabulary is closed and the answer is a
# short JSON object. Thinking tokens are drawn from the same output allowance
# as the answer, so leaving it on can exhaust the budget and return a response
# with no answer part at all (#254).
THINKING_BUDGET = 0
MAX_OUTPUT_TOKENS = 2048

# The client falls back to the manual form on a 503, so this must be
# distinguishable from a 4xx caused by the farmer's own input.
PROVIDER_UNAVAILABLE = "Entry parsing is unavailable. Please use the form."


class LlmError(Exception):
    """The provider could not produce usable output.

    Raised for transport failures, non-200 responses, and output that is not
    JSON. Callers turn this into a structured error the client can fall back
    from — never into a half-parsed entry.
    """


class LlmProvider(Protocol):
    """Anything that can turn a prompt into a JSON object.

    Deliberately narrow: the caller owns the prompt and the schema, the
    provider owns only the round trip. `complete_json` returns the decoded
    object; validating its *shape* is the caller's job.
    """

    async def complete_json(self, prompt: str) -> dict[str, Any]:  # pragma: no cover - protocol
        ...


def strip_code_fence(raw: str) -> str:
    """Remove a ```json fence if the model wrapped its output in one.

    JSON mode usually makes this unnecessary, but models fall back to fenced
    output when they decide to explain themselves, and a fence is the
    difference between a working parse and a 500.
    """
    text = raw.strip()
    if not text.startswith("```"):
        return text
    # Drop the opening fence (with or without a language tag) and the closing one.
    body = text.split("\n", 1)[1] if "\n" in text else ""
    if body.rstrip().endswith("```"):
        body = body.rstrip()[: -len("```")]
    return body.strip()


def decode_json_object(raw: str) -> dict[str, Any]:
    """Decode provider text into a JSON object, or raise :class:`LlmError`."""
    try:
        decoded = json.loads(strip_code_fence(raw))
    except json.JSONDecodeError as exc:
        raise LlmError(f"provider returned non-JSON output: {exc}") from exc
    if not isinstance(decoded, dict):
        raise LlmError("provider returned JSON that is not an object")
    return decoded


class GeminiProvider:
    """Gemini via its REST API.

    Uses ``httpx`` rather than a vendor SDK so the dependency footprint stays
    at what the project already carries.

    The request shape below is Gemini's documented ``generateContent`` call
    with JSON output mode. It is exercised against a stub in tests — the live
    wire format is only proven the first time this runs against the real
    endpoint, so verify it in a deployed environment before relying on it.
    """

    def __init__(self, api_key: str, model: str, timeout_seconds: float) -> None:
        self._api_key = api_key
        self._model = model
        self._timeout = timeout_seconds

    async def complete_json(self, prompt: str) -> dict[str, Any]:
        url = f"{GEMINI_BASE_URL}/{self._model}:generateContent"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                # Deterministic-ish: this is extraction, not composition.
                "temperature": 0.0,
                "maxOutputTokens": MAX_OUTPUT_TOKENS,
                "thinkingConfig": {"thinkingBudget": THINKING_BUDGET},
            },
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    url,
                    # Header rather than a query parameter: a key in a URL
                    # lands in proxy and access logs.
                    headers={"x-goog-api-key": self._api_key},
                    json=payload,
                )
        except httpx.HTTPError as exc:
            logger.warning("chat-entry provider request failed: %s", exc)
            raise LlmError(f"provider request failed: {exc}") from exc

        if response.status_code != 200:
            # Google's error bodies carry a reason but not the key. Log a
            # bounded slice of it — without this, every failure looks the same
            # from the outside and needs a deploy cycle to diagnose (#254).
            logger.warning(
                "chat-entry provider returned HTTP %s for model %r: %s",
                response.status_code,
                self._model,
                response.text[:500],
            )
            if response.status_code == 404:
                # 404 here is not "endpoint missing" — it is Google saying
                # this model name does not exist for this key, or does not
                # support generateContent. Model availability differs by key
                # and changes over time, so name the culprit and the fix
                # rather than leaving a bare status code.
                logger.error(
                    "chat-entry: model %r not available for this API key. "
                    "List the valid names with "
                    "GET https://generativelanguage.googleapis.com/v1beta/models "
                    "and set GEMINI_MODEL to one that supports generateContent.",
                    self._model,
                )
            raise LlmError(f"provider returned HTTP {response.status_code}")

        return decode_json_object(answer_text(response.json()))


def answer_text(body: dict[str, Any]) -> str:
    """Pull the answer out of a Gemini response envelope.

    A 2.5-model response carries several parts — reasoning and answer — each
    flagged with ``thought``. Taking ``parts[0]`` blindly reads a thought, or
    raises on a part with no ``text`` at all, which is what made #254 look
    like a missing API key.

    Concatenates every non-thought text part, so a split answer survives.
    """
    candidates = body.get("candidates") or []
    if not candidates:
        # No candidate at all usually means the prompt itself was blocked.
        logger.warning(
            "chat-entry provider returned no candidates; promptFeedback=%s",
            body.get("promptFeedback"),
        )
        raise LlmError("provider returned no candidates")

    candidate = candidates[0]
    parts = (candidate.get("content") or {}).get("parts") or []
    answer = "".join(
        part["text"]
        for part in parts
        if not part.get("thought") and isinstance(part.get("text"), str)
    )

    if not answer.strip():
        # finishReason is the difference between "ran out of room" and
        # "refused", and is the single most useful field when this happens.
        logger.warning(
            "chat-entry provider returned no answer text; finishReason=%s parts=%s",
            candidate.get("finishReason"),
            [sorted(part.keys()) for part in parts],
        )
        raise LlmError(
            f"provider returned no answer text (finishReason={candidate.get('finishReason')})"
        )
    return answer


def get_llm_provider() -> LlmProvider:
    """FastAPI dependency returning the configured provider.

    Raises ``HTTPException`` rather than :class:`LlmError` when no provider is
    configured. A dependency that raises a plain exception becomes a 500, and
    a blank key is the *default* — so an un-provisioned deployment would have
    returned 500 on every call instead of the 503 the client falls back from.

    Tests override this with a stub, which is why no endpoint constructs a
    provider itself — the suite must never make a live model call.
    """
    settings = get_settings()
    if not settings.gemini_configured:
        raise HTTPException(status_code=503, detail=PROVIDER_UNAVAILABLE)
    return GeminiProvider(
        api_key=settings.gemini_api_key,
        model=settings.gemini_model,
        timeout_seconds=settings.gemini_timeout_seconds,
    )
