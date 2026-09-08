"""Schemas for the PIN session-auth endpoints (issue #45)."""

import re

from pydantic import BaseModel, Field, field_validator

from myfarm_api.schemas.farmer import FarmerRead

_PIN_RE = re.compile(r"^\d{4,6}$")


def normalize_phone(raw: str) -> str:
    """Last 10 digits — matches the frontend's own normalisation so a
    number stored one way is always found the other."""
    digits = re.sub(r"\D", "", raw)
    return digits[-10:] if len(digits) > 10 else digits


class _PhonePin(BaseModel):
    phone: str = Field(min_length=1, max_length=20)
    pin: str

    @field_validator("phone")
    @classmethod
    def _normalize(cls, v: str) -> str:
        phone = normalize_phone(v)
        if len(phone) != 10:
            raise ValueError("phone must be a 10-digit mobile number")
        return phone

    @field_validator("pin")
    @classmethod
    def _check_pin(cls, v: str) -> str:
        if not _PIN_RE.match(v):
            raise ValueError("pin must be 4-6 digits")
        return v


class SessionRequest(_PhonePin):
    """Log in an existing PIN account."""


class RegisterRequest(_PhonePin):
    """Create a PIN account."""

    full_name: str = Field(min_length=3, max_length=255)
    preferred_language: str = Field(default="en", max_length=10)


class SessionResponse(BaseModel):
    """A freshly issued session JWT plus the farmer it belongs to."""

    token: str
    farmer: FarmerRead


class PhoneLookupResponse(BaseModel):
    exists: bool
