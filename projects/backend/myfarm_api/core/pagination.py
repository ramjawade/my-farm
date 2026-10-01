"""Opaque keyset-pagination cursors for list endpoints.

A cursor records the sort it was issued for, the last returned row's sort key
and its id. Keyset paging (rather than OFFSET) keeps a traversal free of
repeats and gaps when rows are created or edited between requests, and its cost
does not grow with the page number.
"""

import base64
import binascii
import json
from dataclasses import dataclass

# Requests without `limit` return everything until the client rollout in
# paginate-activities-and-expenses (#323) flips this to 100.
DEFAULT_PAGE_LIMIT: int | None = None


class InvalidCursorError(ValueError):
    """The cursor is malformed or was issued for a different sort order."""


@dataclass(frozen=True)
class CursorPosition:
    """Where the previous page ended: the last row's sort key (None for a NULL key) and id."""

    key: str | None
    id: int


def encode_cursor(sort: str, key: str | None, row_id: int) -> str:
    payload = json.dumps({"s": sort, "k": key, "id": row_id}, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")


def decode_cursor(raw: str, sort: str) -> CursorPosition:
    """Decode `raw`, raising InvalidCursorError unless it was issued for `sort`."""
    try:
        padded = raw + "=" * (-len(raw) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode()))
        cursor_sort, key, row_id = data["s"], data["k"], data["id"]
    except (binascii.Error, ValueError, KeyError, TypeError) as exc:
        raise InvalidCursorError("Invalid cursor") from exc
    if (
        cursor_sort != sort
        or not isinstance(row_id, int)
        or isinstance(row_id, bool)
        or not (key is None or isinstance(key, str))
    ):
        raise InvalidCursorError("Invalid cursor")
    return CursorPosition(key=key, id=row_id)
