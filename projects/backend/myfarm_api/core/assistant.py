"""Prompts, output checks and fallbacks for the farmer assistant (#288).

Pure functions only — no I/O, no provider, no database — so all of it is
testable with plain strings and no live model call.

The model does two narrow jobs and never touches the database:

1. **Route**: label a message ``log`` / ``question`` / ``unsupported`` and, for
   a question, pick one topic from a closed set and name the crop, land and
   period it is about.
2. **Word**: turn the facts the backend queried into a short answer in the
   farmer's language.

Because the second job is free text, every number in it is checked against the
facts it was given (:func:`numbers_grounded`). A figure the backend did not
compute is never shown; the localized fallback rendering is used instead.
"""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Any, Literal, get_args

from pydantic import BaseModel

from myfarm_api.core.assistant_queries import Period

Intent = Literal["log", "question", "unsupported"]
Topic = Literal[
    "spend",
    "spend_by_category",
    "recent_activities",
    "pending_activities",
    "lands",
    "crops",
    "weather",
]

TOPICS: tuple[str, ...] = get_args(Topic)
PERIODS: tuple[str, ...] = get_args(Period)

SUPPORTED_LANGUAGES = ("en", "hi", "mr")
LANGUAGE_NAMES = {"en": "English", "hi": "Hindi (Devanagari)", "mr": "Marathi (Devanagari)"}


def pick_language(requested: str | None, preferred: str | None) -> str:
    """The client's language, else the farmer's preference, else English."""
    for candidate in (requested, preferred):
        if candidate and candidate.lower() in SUPPORTED_LANGUAGES:
            return candidate.lower()
    return "en"


# ------------------------------------------------------------------ routing


class RoutedMessage(BaseModel):
    """What the routing call must return. Anything else is a provider fault."""

    intent: Intent
    topic: Topic | None = None
    crop: str | None = None
    land: str | None = None
    period: Period | None = None


ROUTING_TEMPLATE = """You route a farmer's chat message for a farm-record app.

Return ONLY a JSON object with this exact shape:

{{
  "intent": "log" | "question" | "unsupported",
  "topic": <one of TOPICS, or null>,
  "crop": "<crop name the farmer mentioned, or null>",
  "land": "<land or field name the farmer mentioned, or null>",
  "period": <one of PERIODS, or null>
}}

Meaning of "intent":
- "log": the farmer is telling you about work they did or money they spent
  (e.g. "sprayed pesticide on plot 1, paid 500 for labour"). Also use "log" if
  you are unsure whether it is a log or a question.
- "question": the farmer asks about their own recorded farm data.
- "unsupported": anything else (chit-chat, farming advice, jokes, other topics).

TOPICS (only for "question"; use these exact strings, nothing else):
{topics}

PERIODS (only when the farmer names a time span; null means all time):
{periods}

Rules:
- Set "topic", "crop", "land" and "period" to null unless intent is "question".
- Never invent a topic or period outside the lists above. If no topic fits the
  question, use intent "unsupported".
- "crop" and "land" are the words the farmer used, unchanged. Null if not named.
- Today is {today}. "this season" or "this year" -> "this_year"; "this month" ->
  "this_month"; "last month" -> "last_month"; "this week" -> "this_week";
  "today"/"aaj"/"आज" -> "today".
- The farmer may write in {language}, in English, or a mix, including
  Latin-script transliteration. Handle all of these.

Farmer's message:
{text}
"""


def build_routing_prompt(*, text: str, today: date, language: str) -> str:
    return ROUTING_TEMPLATE.format(
        topics=_bullets(TOPICS),
        periods=_bullets(PERIODS),
        today=today.isoformat(),
        language=LANGUAGE_NAMES[language],
        # json.dumps: the farmer's text is untrusted; quoting it keeps a stray
        # brace or quote from reshaping the instructions above it.
        text=json.dumps(text, ensure_ascii=False),
    )


# ------------------------------------------------------------------- answer


class AnswerOutput(BaseModel):
    answer: str


ANSWER_TEMPLATE = """You answer a farmer's question about their own farm records.

Return ONLY a JSON object: {{"answer": "<your reply>"}}

Rules:
- Use ONLY the FACTS below. Every number, name and date in your reply must come
  from them. Never estimate, add up new totals, or use outside knowledge.
- Reply in {language}. Keep it to at most three short sentences, plain words a
  farmer would use. Amounts are in Indian rupees (₹).
- No farming advice or recommendations — just report what the facts say.
- If a list is long, mention at most the first five items.
- If FACTS say the weather source is "mock", say the weather is approximate and
  not live.

QUESTION:
{question}

FACTS (JSON):
{facts}
"""


def build_answer_prompt(*, question: str, facts: dict[str, Any], language: str) -> str:
    return ANSWER_TEMPLATE.format(
        language=LANGUAGE_NAMES[language],
        question=json.dumps(question, ensure_ascii=False),
        facts=json.dumps(facts, ensure_ascii=False, default=str, indent=2),
    )


# ------------------------------------------------------------ number check

# Digits in any of the scripts the app supports, mapped to ASCII.
_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
# "1,600", "1,60,000" (Indian grouping), "12.5", "2026".
_NUMBER = re.compile(r"\d+(?:,\d{2,3})*(?:\.\d+)?")


def numbers_in(text: str) -> list[float]:
    return [float(m.replace(",", "")) for m in _NUMBER.findall(text.translate(_DIGITS))]


def numbers_grounded(answer: str, facts: dict[str, Any]) -> bool:
    """True when every number in ``answer`` appears in ``facts``.

    Facts are scanned as text so dates ("2026-09-10") and names ("Plot 2")
    contribute their digits too. A tolerance of half a unit allows rounding a
    decimal ("30.6" -> "31") but not changing a whole number.
    """
    allowed = numbers_in(json.dumps(facts, ensure_ascii=False, default=str))
    return all(any(abs(n - f) <= 0.5 for f in allowed) for n in numbers_in(answer))


# ---------------------------------------------------------------- fallbacks

MESSAGES: dict[str, dict[str, str]] = {
    "en": {
        "spend": "Total spent",
        "spend_by_category": "Spending by category",
        "recent_activities": "Recent activities",
        "pending_activities": "Pending activities",
        "lands": "Your lands",
        "crops": "Your crops",
        "weather": "Weather",
        "empty": "Nothing has been recorded for that yet.",
        "no_location": "I can't check the weather because that land has no map location yet.",
        "weather_unavailable": "The weather isn't available right now. Please try again later.",
    },
    "hi": {
        "spend": "कुल खर्च",
        "spend_by_category": "श्रेणी के अनुसार खर्च",
        "recent_activities": "हाल की गतिविधियाँ",
        "pending_activities": "बाकी गतिविधियाँ",
        "lands": "आपकी जमीनें",
        "crops": "आपकी फसलें",
        "weather": "मौसम",
        "empty": "इसके लिए अभी तक कुछ दर्ज नहीं है।",
        "no_location": "मौसम नहीं देख सकता क्योंकि उस जमीन का नक्शे पर स्थान अभी नहीं है।",
        "weather_unavailable": "मौसम अभी उपलब्ध नहीं है। कृपया बाद में कोशिश करें।",
    },
    "mr": {
        "spend": "एकूण खर्च",
        "spend_by_category": "प्रकारानुसार खर्च",
        "recent_activities": "अलीकडील कामे",
        "pending_activities": "प्रलंबित कामे",
        "lands": "तुमच्या जमिनी",
        "crops": "तुमची पिके",
        "weather": "हवामान",
        "empty": "यासाठी अजून काही नोंदवलेले नाही.",
        "no_location": "हवामान पाहता येत नाही कारण त्या जमिनीचे नकाशावरील ठिकाण अजून नाही.",
        "weather_unavailable": "हवामान सध्या उपलब्ध नाही. कृपया नंतर प्रयत्न करा.",
    },
}


def message(language: str, key: str) -> str:
    return MESSAGES[language][key]


def _activity_line(a: dict[str, Any]) -> str:
    parts = [a.get("date"), a["activity"], a.get("land"), a.get("crop"), a.get("status")]
    return " · ".join(str(p) for p in parts if p)


def fallback_answer(topic: str, facts: dict[str, Any], language: str) -> str:
    """Render facts without a model: a localized header and language-neutral lines.

    Used when the model's wording cited a number the backend did not compute.
    """
    header = message(language, topic)
    data = facts["data"]
    if topic == "spend":
        return f"{header}: ₹{data['total']:,.2f}".replace(".00", "")
    if topic == "spend_by_category":
        lines = [f"{c['category']}: ₹{c['total']:,.2f}".replace(".00", "") for c in data["items"]]
    elif topic in ("recent_activities", "pending_activities"):
        lines = [_activity_line(a) for a in data["items"][:5]]
    elif topic == "lands":
        lines = [
            f"{x['name']} ({', '.join(x['crops'])})" if x["crops"] else x["name"]
            for x in data["items"]
        ]
    elif topic == "crops":
        lines = [f"{c['name']} · {c['land']}" for c in data["items"]]
    else:  # weather
        w = data["weather"]
        lines = [f"{data['land']}: {w['temp_c']}°C, {w['description']}"]
    return "\n".join([f"{header}:", *lines])


def _bullets(values: tuple[str, ...]) -> str:
    return "\n".join(f"- {v}" for v in values)
