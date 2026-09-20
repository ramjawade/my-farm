"""Pydantic schemas for natural-language entry parsing (#241).

The parsed result carries **names, never database ids**. Ids are per-database
and a model asked for one would invent it; names are stable and checkable
against the reference tables. Resolving names to ids — and rejecting names
that do not resolve — is #242's job, deliberately not this endpoint's.
"""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class ParsedExpense(BaseModel):
    """One expense line the model found in the text.

    Every field is optional. A field the model was unsure of must arrive as
    ``None`` — a blank field costs the farmer one tap, a guessed one corrupts
    a record they may not notice for a season.
    """

    category: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    rate: Decimal | None = None
    amount: Decimal | None = None
    remarks: str | None = None


class ParsedEntry(BaseModel):
    """An activity plus its expenses, as names rather than ids."""

    transcript: str = Field(
        description=(
            "What the model understood the input to be. Echoes the typed text "
            "today; with #232 it carries the transcription of spoken audio, "
            "which is why it is not simply the request field."
        )
    )
    activity_type: str | None = None
    date: str | None = None
    crop: str | None = None
    land: str | None = None
    notes: str | None = None
    expenses: list[ParsedExpense] = Field(default_factory=list)


class DroppedField(BaseModel):
    """A value the model produced that we refused to use, and why.

    Reported rather than silently blanked so the UI can say "we did not
    recognise that land" instead of showing an unexplained empty field.
    """

    field: str
    value: str
    reason: Literal["not_found", "ambiguous"]


class ResolvedExpense(BaseModel):
    """An expense line with its category resolved to an id.

    ``expense_category_id`` may be null while the rest of the line is intact:
    an unrecognised category must not discard a correct amount.
    """

    expense_category_id: int | None = None
    category: str | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    rate: Decimal | None = None
    amount: Decimal | None = None
    remarks: str | None = None


class ResolvedEntry(BaseModel):
    """An entry carrying database ids, ready for the client to post.

    Names are kept alongside the ids so the UI can show what was understood,
    and so #244 can store the pair as provenance.
    """

    transcript: str
    activity_type_id: int
    activity_type: str
    date: str | None = None
    crop_id: int | None = None
    crop: str | None = None
    land_id: int | None = None
    land: str | None = None
    notes: str | None = None
    expenses: list[ResolvedExpense] = Field(default_factory=list)
    dropped: list[DroppedField] = Field(default_factory=list)


class ChatParseRequest(BaseModel):
    """Plain-language text describing one activity."""

    text: str = Field(min_length=1, max_length=2000)
    language: str | None = Field(
        default=None,
        description="BCP-47-ish hint, e.g. 'hi'. Falls back to the farmer's preferred_language.",
    )


class ChatParseResponse(BaseModel):
    """The resolved entry and what produced it.

    Carries ids, not just names: the client already holds the reference data,
    and the save payload for `POST /api/v1/activities` is ids, so resolving
    here means the UI never has to string-match. Resolution is server-side
    because the checks are a tenant boundary, and a client-side check is not
    a boundary at all.

    ``model`` is recorded so #244 can store provenance on the created entry
    and so accuracy can later be compared across providers.
    """

    parsed: ResolvedEntry
    model: str
