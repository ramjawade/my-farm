"""POST /api/v1/assistant/ask (#288).

Every test runs against a scripted provider: the suite must never make a live
model call. The script is one entry per provider call, so a test also pins
*how many* calls a path costs — routing only, or routing plus wording.
"""

import logging
from collections.abc import Iterator
from typing import Any
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from myfarm_api.core import assistant_queries
from myfarm_api.core.llm import LlmError
from myfarm_api.core.llm import get_llm_provider as real_get_llm_provider
from myfarm_api.main import app
from tests.assistant_helpers import AUTH, Farm, signed_in

URL = "/api/v1/assistant/ask"


class ScriptedProvider:
    """Plays back one canned result (or error) per call and records the prompts."""

    def __init__(self, *script: dict[str, Any] | Exception) -> None:
        self._script = list(script)
        self.prompts: list[str] = []

    @property
    def calls(self) -> int:
        return len(self.prompts)

    async def complete_json(self, prompt: str) -> dict[str, Any]:
        self.prompts.append(prompt)
        step = self._script.pop(0)
        if isinstance(step, Exception):
            raise step
        return step


def use(provider: ScriptedProvider) -> ScriptedProvider:
    app.dependency_overrides[real_get_llm_provider] = lambda: provider
    return provider


@pytest.fixture(autouse=True)
def _clear_overrides() -> Iterator[None]:
    yield
    app.dependency_overrides.pop(real_get_llm_provider, None)


def question(topic: str, **extra: Any) -> dict[str, Any]:
    return {"intent": "question", "topic": topic, **extra}


async def ask(client: AsyncClient, text: str = "a question", **body: Any) -> Any:
    return await client.post(URL, headers=AUTH, json={"text": text, **body})


# ----------------------------------------------------------------- routing


@pytest.mark.asyncio
async def test_log_intent_costs_one_call_and_carries_nothing_else(client: AsyncClient) -> None:
    provider = use(ScriptedProvider({"intent": "log"}))
    with signed_in(f"farmer_{uuid4()}"):
        resp = await ask(client, "sprayed pesticide on plot 1")

    assert resp.status_code == 200
    assert resp.json() == {"intent": "log", "answer": None, "needs_clarification": None}
    assert provider.calls == 1
    assert "sprayed pesticide on plot 1" in provider.prompts[0]


@pytest.mark.asyncio
async def test_unsupported_intent(client: AsyncClient) -> None:
    provider = use(ScriptedProvider({"intent": "unsupported"}))
    with signed_in(f"farmer_{uuid4()}"):
        resp = await ask(client, "tell me a joke")

    assert resp.json()["intent"] == "unsupported"
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_question_without_a_topic_is_unsupported(client: AsyncClient) -> None:
    use(ScriptedProvider({"intent": "question"}))
    with signed_in(f"farmer_{uuid4()}"):
        resp = await ask(client)

    assert resp.json()["intent"] == "unsupported"


# ---------------------------------------------------------------- answers


@pytest.mark.asyncio
async def test_spend_question_is_answered_from_the_farmers_facts(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    provider = use(
        ScriptedProvider(
            question("spend", crop="Front patch", period="all"),
            {"answer": "You have spent ₹250 on Front patch."},
        )
    )
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup(label="Front patch")
        await farm.expense(await farm.activity(crop_id=farm.crop_id), "250")
        resp = await ask(client, "how much on front patch?")

    assert resp.status_code == 200
    assert resp.json() == {
        "intent": "question",
        "answer": "You have spent ₹250 on Front patch.",
        "needs_clarification": None,
    }
    assert provider.calls == 2
    assert "250.0" in provider.prompts[1]  # the wording call was given the queried total


@pytest.mark.asyncio
async def test_the_answer_call_uses_the_requested_language(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    provider = use(ScriptedProvider(question("spend"), {"answer": "एकूण ₹७५ खर्च."}))
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.expense(await farm.activity(), "75")
        resp = await ask(client, language="mr")

    assert resp.json()["answer"] == "एकूण ₹७५ खर्च."
    assert all("Marathi" in p for p in provider.prompts)


@pytest.mark.asyncio
async def test_pending_activities_question(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    provider = use(
        ScriptedProvider(
            question("pending_activities", land="Plot 1"),
            {"answer": "1 pending activity on Plot 1."},
        )
    )
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.activity(land_id=farm.land_id, status="Scheduled", date="2026-10-01")
        await farm.activity(land_id=farm.land_id, status="Completed")
        resp = await ask(client)

    assert resp.json()["answer"] == "1 pending activity on Plot 1."
    assert "2026-10-01" in provider.prompts[1]
    assert "Completed" not in provider.prompts[1]


@pytest.mark.asyncio
async def test_nothing_recorded_is_stated_without_a_second_call(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    provider = use(ScriptedProvider(question("spend")))
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.activity()  # an activity, but no expense
        resp = await ask(client)

    assert resp.json()["answer"] == "Nothing has been recorded for that yet."
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_empty_answer_is_localized(client: AsyncClient) -> None:
    use(ScriptedProvider(question("lands")))
    with signed_in(f"farmer_{uuid4()}"):
        resp = await ask(client, language="hi")

    assert resp.json()["answer"] == "इसके लिए अभी तक कुछ दर्ज नहीं है।"


@pytest.mark.asyncio
async def test_a_figure_the_backend_did_not_compute_is_replaced_by_the_facts(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    use(ScriptedProvider(question("spend"), {"answer": "You spent ₹999,999 in total."}))
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.expense(await farm.activity(), "250")
        resp = await ask(client)

    assert resp.json()["answer"] == "Total spent: ₹250"


# ------------------------------------------------------- names and scope


@pytest.mark.asyncio
async def test_unknown_crop_asks_with_the_farmers_own_crops(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    provider = use(ScriptedProvider(question("spend", crop="cotton")))
    with signed_in(uid):
        await Farm(client, reference_ids, uid).setup(label="Front patch")
        resp = await ask(client, "and for the cotton?")

    assert resp.json() == {
        "intent": "question",
        "answer": None,
        "needs_clarification": {"field": "crop", "reason": "unknown", "options": ["Front patch"]},
    }
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_two_lands_with_one_name_are_ambiguous(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    use(ScriptedProvider(question("recent_activities", land="Back Field")))
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup(land_name="Back Field")
        await farm.add_land("Back Field")
        resp = await ask(client)

    clarification = resp.json()["needs_clarification"]
    assert (clarification["field"], clarification["reason"]) == ("land", "ambiguous")


@pytest.mark.asyncio
async def test_another_farmers_crop_is_never_a_candidate(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid_a, uid_b = f"farmer_a_{uuid4()}", f"farmer_b_{uuid4()}"
    with signed_in(uid_a):
        await Farm(client, reference_ids, uid_a).setup(label="Secret crop")

    use(ScriptedProvider(question("spend", crop="Secret crop")))
    with signed_in(uid_b):
        await Farm(client, reference_ids, uid_b).setup(label="B crop")
        resp = await ask(client)

    clarification = resp.json()["needs_clarification"]
    assert clarification["reason"] == "unknown"
    assert clarification["options"] == ["B crop"]


@pytest.mark.asyncio
async def test_names_are_ignored_for_topics_that_do_not_use_them(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    use(ScriptedProvider(question("lands", crop="cotton"), {"answer": "You have 1 land."}))
    with signed_in(uid):
        await Farm(client, reference_ids, uid).setup()
        resp = await ask(client)

    assert resp.json()["answer"] == "You have 1 land."


# ------------------------------------------------------------------ weather


@pytest.mark.asyncio
async def test_weather_for_the_only_located_land(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    live = {"data": {"main": {"temp": 31}, "weather": [{"description": "clear"}]}, "source": "live"}
    provider = use(ScriptedProvider(question("weather"), {"answer": "Clear, 31 degrees."}))
    with signed_in(uid):
        await Farm(client, reference_ids, uid).setup()
        with patch.object(assistant_queries, "get_weather", AsyncMock(return_value=live)):
            resp = await ask(client)

    assert resp.json()["answer"] == "Clear, 31 degrees."
    assert "Plot 1" in provider.prompts[1]


@pytest.mark.asyncio
async def test_weather_with_several_lands_asks_which(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    use(ScriptedProvider(question("weather")))
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.add_land("Plot 2")
        resp = await ask(client)

    assert resp.json()["needs_clarification"] == {
        "field": "land",
        "reason": "ambiguous",
        "options": ["Plot 1", "Plot 2"],
    }


@pytest.mark.asyncio
async def test_weather_for_a_land_with_no_map_location(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    use(ScriptedProvider(question("weather")))
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        # The only land has no points, so there is nowhere to look up.
        await farm.add_land("Unmapped", with_points=False)
        with patch.object(assistant_queries, "land_locations", AsyncMock(return_value=[])):
            resp = await ask(client)

    assert "no map location" in resp.json()["answer"]


# ---------------------------------------------------------------- failures


@pytest.mark.asyncio
async def test_provider_down_during_routing_is_503(client: AsyncClient) -> None:
    use(ScriptedProvider(LlmError("down")))
    with signed_in(f"farmer_{uuid4()}"):
        resp = await ask(client)

    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_provider_down_during_wording_is_503_not_an_invented_answer(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    use(ScriptedProvider(question("spend"), LlmError("down")))
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.expense(await farm.activity(), "250")
        resp = await ask(client)

    assert resp.status_code == 503


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad",
    [{"intent": "chat"}, {"intent": "question", "topic": "drop_tables"}, {"unexpected": True}],
)
async def test_unusable_routing_output_is_503(client: AsyncClient, bad: dict[str, Any]) -> None:
    use(ScriptedProvider(bad))
    with signed_in(f"farmer_{uuid4()}"):
        resp = await ask(client)

    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_unusable_answer_output_is_503(
    client: AsyncClient, reference_ids: dict[str, str]
) -> None:
    uid = f"farmer_{uuid4()}"
    use(ScriptedProvider(question("spend"), {"reply": "wrong key"}))
    with signed_in(uid):
        farm = await Farm(client, reference_ids, uid).setup()
        await farm.expense(await farm.activity(), "250")
        resp = await ask(client)

    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_logs_carry_intent_and_topic_but_not_the_farmers_words(
    client: AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    use(ScriptedProvider(question("lands")))
    with caplog.at_level(logging.INFO), signed_in(f"farmer_{uuid4()}"):
        await ask(client, "my very private words")

    assert "intent=question topic=lands" in caplog.text
    assert "my very private words" not in caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [{"text": ""}, {"text": "x" * 2001}, {}])
async def test_invalid_request_is_422(client: AsyncClient, body: dict[str, Any]) -> None:
    use(ScriptedProvider())
    with signed_in(f"farmer_{uuid4()}"):
        resp = await client.post(URL, headers=AUTH, json=body)

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient) -> None:
    use(ScriptedProvider())
    resp = await client.post(URL, json={"text": "hi"})

    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_unconfigured_provider_is_503(client: AsyncClient) -> None:
    """No override: the real dependency refuses when no API key is set."""
    with signed_in(f"farmer_{uuid4()}"):
        resp = await ask(client)

    assert resp.status_code == 503
