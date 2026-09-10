"""Pydantic schemas for weather endpoints."""

from typing import Any

from pydantic import BaseModel


class WeatherResponse(BaseModel):
    """Weather data response."""

    data: dict[str, Any]  # OpenWeatherMap API response
    source: str  # 'live', 'cached', 'mock', 'error'
    fetched_at: str | None = None
    cached_at: str | None = None
    warning: str | None = None
