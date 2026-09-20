"""Reading a Gemini response envelope (#254).

These payloads are the shapes a 2.5-model actually returns. The original code
was written against a stub — it took `parts[0]` and assumed that was the
answer, which is wrong as soon as the model emits a thought part, and that
produced a 503 indistinguishable from a missing API key.
"""

import pytest

from myfarm_api.core.llm import LlmError, answer_text

ANSWER = '{"transcript": "t", "activity_type": "Irrigation", "expenses": []}'


def _body(parts: list[dict[str, object]], **candidate_extra: object) -> dict[str, object]:
    return {"candidates": [{"content": {"parts": parts}, **candidate_extra}]}


def test_plain_single_part() -> None:
    assert answer_text(_body([{"text": ANSWER}])) == ANSWER


def test_skips_a_leading_thought_part() -> None:
    """The regression: a thought part arrives first and is not the answer."""
    body = _body([{"text": "Let me work through this…", "thought": True}, {"text": ANSWER}])
    assert answer_text(body) == ANSWER


def test_joins_an_answer_split_across_parts() -> None:
    body = _body([{"text": '{"transcript": "t",'}, {"text": ' "activity_type": "Irrigation"}'}])
    assert answer_text(body) == '{"transcript": "t", "activity_type": "Irrigation"}'


def test_part_without_text_is_ignored_not_fatal() -> None:
    """A part carrying no `text` key at all used to raise KeyError."""
    body = _body([{"functionCall": {"name": "x"}}, {"text": ANSWER}])
    assert answer_text(body) == ANSWER


def test_thought_only_response_reports_finish_reason() -> None:
    """Thinking can exhaust maxOutputTokens, leaving no answer part.

    The error must name finishReason — that is the difference between "ran
    out of room" and "refused", and it is what makes this diagnosable.
    """
    body = _body([{"text": "thinking…", "thought": True}], finishReason="MAX_TOKENS")
    with pytest.raises(LlmError, match="MAX_TOKENS"):
        answer_text(body)


def test_empty_parts_is_an_error() -> None:
    with pytest.raises(LlmError):
        answer_text(_body([], finishReason="SAFETY"))


def test_no_candidates_is_an_error() -> None:
    """A blocked prompt comes back with no candidate at all."""
    with pytest.raises(LlmError, match="no candidates"):
        answer_text({"promptFeedback": {"blockReason": "SAFETY"}})


def test_missing_content_key_is_an_error() -> None:
    with pytest.raises(LlmError):
        answer_text({"candidates": [{"finishReason": "MAX_TOKENS"}]})
