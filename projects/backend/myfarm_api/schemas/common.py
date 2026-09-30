from datetime import date
from decimal import Decimal
from typing import Annotated, Any, ClassVar

from fastapi import Path
from pydantic import AfterValidator, BaseModel, Field, StringConstraints, model_validator

# Postgres BIGINT ceiling. Ids beyond it make asyncpg raise mid-query (a 500),
# so reject them at the edge instead.
MAX_DB_ID = 2**63 - 1

DbId = Annotated[int, Path(ge=1, le=MAX_DB_ID)]
"""A row id taken from the URL path."""

BodyId = Annotated[int, Field(ge=1, le=MAX_DB_ID)]
"""A row id taken from a request body."""

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]

# Bounds mirror the Numeric(precision, 2) columns in models.py. Only the integer
# side is capped: clients compute amounts (qty * rate) and may send >2 decimals.
Decimal12 = Annotated[Decimal, Field(ge=0, lt=Decimal(10) ** 10)]
"""Non-negative value that fits Numeric(12, 2)."""

Decimal10 = Annotated[Decimal, Field(ge=0, lt=Decimal(10) ** 8)]
"""Non-negative value that fits Numeric(10, 2)."""

Latitude = Annotated[Decimal, Field(ge=-90, le=90)]
Longitude = Annotated[Decimal, Field(ge=-180, le=180)]


def _check_iso_date(value: str) -> str:
    try:
        date.fromisoformat(value[:10])
    except ValueError:
        raise ValueError("must be an ISO date (YYYY-MM-DD)") from None
    return value


IsoDate = Annotated[str, AfterValidator(_check_iso_date)]


class NonNullUpdate(BaseModel):
    """PATCH schema whose listed fields may be omitted but never set to null.

    Update models declare every field `X | None` so omission means "leave
    alone"; without this an explicit `null` reaches a NOT NULL column (a 500).
    """

    non_null: ClassVar[tuple[str, ...]] = ()

    @model_validator(mode="after")
    def _reject_explicit_null(self) -> Any:
        for field in self.non_null:
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


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
