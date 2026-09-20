"""Prompt construction for natural-language entry parsing (#241).

Pure functions only — no I/O, no provider, no database. That is deliberate:
this is the part most likely to need tuning, and it should be testable with
plain strings and no live model call.

The vocabulary is **read from the reference tables at runtime** and injected
into the prompt as the only permitted values. Hardcoding it here would let
the prompt drift away from the database the moment either changes, and a
value the model emits that does not exist in the reference tables is exactly
the failure #242 has to reject.
"""

from __future__ import annotations

import json
from datetime import date as date_cls

PROMPT_TEMPLATE = """You extract farm record entries from a farmer's own words.

Return ONLY a JSON object with this exact shape:

{{
  "transcript": "<the input text, unchanged>",
  "activity_type": <one of ACTIVITY_TYPES, or null>,
  "date": "<YYYY-MM-DD, or null>",
  "crop": "<crop name mentioned, or null>",
  "land": "<land or field name mentioned, or null>",
  "notes": "<short note, or null>",
  "expenses": [
    {{
      "category": <one of EXPENSE_CATEGORIES, or null>,
      "quantity": <number or null>,
      "unit": "<bag, kg, litre, acre, hour, ... or null>",
      "rate": <number or null>,
      "amount": <total money spent, number or null>,
      "remarks": "<what was bought, or null>"
    }}
  ]
}}

ACTIVITY_TYPES (use these exact strings, nothing else):
{activity_types}

EXPENSE_CATEGORIES (use these exact strings, nothing else):
{expense_categories}

Rules:
- Today is {today}. Resolve "today", "aaj", "आज" to that date; "yesterday",
  "kal", "कल" to the day before. If no date is mentioned, use today.
- If you are not confident about a field, return null for it. Never guess.
  A null field is correct behaviour, not a failure.
- Never invent an activity type or expense category outside the lists above.
- If no money is mentioned, return an empty "expenses" list.
- If the text describes no farm activity at all, return null for
  "activity_type" and an empty "expenses" list.
- The farmer may write in {language}, in English, or in a mix of both,
  including Latin-script transliteration. Handle all of these.

Farmer's text:
{text}
"""


def build_prompt(
    *,
    text: str,
    activity_types: list[str],
    expense_categories: list[str],
    today: date_cls,
    language: str,
) -> str:
    """Render the extraction prompt.

    ``activity_types`` and ``expense_categories`` come from the reference
    tables, so the permitted values and the database cannot drift apart.
    """
    return PROMPT_TEMPLATE.format(
        activity_types=_as_bullet_list(activity_types),
        expense_categories=_as_bullet_list(expense_categories),
        today=today.isoformat(),
        language=language,
        # json.dumps, not bare interpolation: the farmer's text is untrusted
        # input, and quoting it keeps a stray brace or quote from reshaping
        # the instructions above it.
        text=json.dumps(text, ensure_ascii=False),
    )


def _as_bullet_list(values: list[str]) -> str:
    return "\n".join(f"- {v}" for v in values)
