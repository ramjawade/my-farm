"""Pydantic schemas for natural-language entry parsing (#241).

The parsed result carries **names, never database ids**. Ids are per-database
and a model asked for one would invent it; names are stable and checkable
against the reference tables. Resolving names to ids — and rejecting names
that do not resolve — is #242's job, deliberately not this endpoint's.
"""

from decimal import Decimal

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


class ChatParseRequest(BaseModel):
    """Plain-language text describing one activity."""

    text: str = Field(min_length=1, max_length=2000)
    language: str | None = Field(
        default=None,
        description="BCP-47-ish hint, e.g. 'hi'. Falls back to the farmer's preferred_language.",
    )


class ChatParseResponse(BaseModel):
    """The parsed entry and what produced it.

    ``model`` is recorded so #244 can store provenance on the created entry
    and so accuracy can later be compared across providers.
    """

    parsed: ParsedEntry
    model: str
