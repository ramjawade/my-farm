from pydantic import BaseModel


class Page[T](BaseModel):
    """Cursor-paginated response envelope (BACKEND_PLAN.md §7: `?cursor=&limit=`
    over `(updated_at, id)`, never `OFFSET`)."""

    items: list[T]
    next_cursor: str | None = None


class ProblemDetail(BaseModel):
    """RFC 9457 `application/problem+json` — one error shape for every
    endpoint, so the client has one thing to parse (BACKEND_PLAN.md §7)."""

    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
