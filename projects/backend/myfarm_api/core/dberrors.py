"""Translate Postgres errors into the right HTTP status.

Without this every constraint failure is an unhandled 500, or (worse) an
`IntegrityError` blanket-labelled "already exists" even when it is a bad
foreign key.
"""

from sqlalchemy.exc import DBAPIError

UNIQUE_VIOLATION = "23505"
FOREIGN_KEY_VIOLATION = "23503"
NOT_NULL_VIOLATION = "23502"
NUMERIC_OUT_OF_RANGE = "22003"

# Client-fixable input problems: the request is well-formed but names a row that
# does not exist or carries a value the column cannot hold.
_UNPROCESSABLE = {FOREIGN_KEY_VIOLATION, NOT_NULL_VIOLATION, NUMERIC_OUT_OF_RANGE}

_MESSAGES = {
    FOREIGN_KEY_VIOLATION: "Referenced record does not exist",
    NOT_NULL_VIOLATION: "A required field is missing or null",
    NUMERIC_OUT_OF_RANGE: "A numeric value is out of range",
}


def sqlstate(exc: BaseException) -> str | None:
    """The Postgres SQLSTATE behind a SQLAlchemy error, if it carries one."""
    if isinstance(exc, DBAPIError):
        orig = exc.orig
        code = getattr(orig, "sqlstate", None) or getattr(
            getattr(orig, "__cause__", None), "sqlstate", None
        )
        if isinstance(code, str):
            return code
    return None


def is_unique_violation(exc: BaseException) -> bool:
    return sqlstate(exc) == UNIQUE_VIOLATION


def unprocessable_message(exc: BaseException) -> str | None:
    """Message for a 422 when `exc` is a client-input DB error, else None."""
    code = sqlstate(exc)
    if code in _UNPROCESSABLE:
        return _MESSAGES[code]
    # asyncpg rejects an out-of-int64 parameter before Postgres sees it, so it
    # has no SQLSTATE; bodies/paths are bounded upstream, this is the backstop.
    if isinstance(exc, DBAPIError) and "out of int64 range" in str(exc.orig):
        return "An id is out of range"
    return None
