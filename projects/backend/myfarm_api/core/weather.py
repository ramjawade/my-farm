"""Weather service with location-grid caching."""

import os
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

import httpx

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5"

# In-memory cache: key = rounded_lat:rounded_lng, value = (data, timestamp)
_weather_cache: dict[str, tuple[dict[str, Any], datetime]] = {}
CACHE_TTL_MINUTES = 30


def round_coordinates(
    lat: Decimal | float, lng: Decimal | float, precision: int = 1
) -> tuple[float, float]:
    """Round coordinates to nearest grid cell (default 1 degree)."""
    rounded_lat = round(float(lat), precision)
    rounded_lng = round(float(lng), precision)
    return (rounded_lat, rounded_lng)


def get_cache_key(lat: float, lng: float) -> str:
    """Generate cache key from rounded coordinates."""
    return f"{lat}:{lng}"


async def get_weather(
    lat: Decimal | float, lng: Decimal | float
) -> dict[str, Any]:
    """Get weather for coordinates with caching and fallback.

    4-tier fallback:
    1. Live API
    2. Cached data
    3. Mock data
    4. Error

    Returns a dict with 'data' (weather info), 'source' ('live'|'cached'|'mock'|'error'),
    and optional 'error' message.
    """
    # Round coordinates to grid
    rounded_lat, rounded_lng = round_coordinates(lat, lng)
    cache_key = get_cache_key(rounded_lat, rounded_lng)

    # Check cache
    if cache_key in _weather_cache:
        cached_data, cached_time = _weather_cache[cache_key]
        if datetime.now() - cached_time < timedelta(minutes=CACHE_TTL_MINUTES):
            return {
                "data": cached_data,
                "source": "cached",
                "cached_at": cached_time.isoformat(),
            }

    # Try live API
    if OPENWEATHER_API_KEY:
        try:
            weather_data = await _fetch_from_api(rounded_lat, rounded_lng)
            # Cache the result
            _weather_cache[cache_key] = (weather_data, datetime.now())
            return {
                "data": weather_data,
                "source": "live",
                "fetched_at": datetime.now().isoformat(),
            }
        except Exception as e:
            print(f"Weather API error: {e}")

    # Fallback to cache if available (expired)
    if cache_key in _weather_cache:
        cached_data, cached_time = _weather_cache[cache_key]
        return {
            "data": cached_data,
            "source": "cached",
            "cached_at": cached_time.isoformat(),
            "warning": "Using stale cache",
        }

    # Fallback to mock data
    return {
        "data": _get_mock_weather(rounded_lat, rounded_lng),
        "source": "mock",
    }


async def _fetch_from_api(lat: float, lng: float) -> dict[str, Any]:
    """Fetch weather from OpenWeatherMap API."""
    if not OPENWEATHER_API_KEY:
        raise ValueError("OPENWEATHER_API_KEY not configured")

    async with httpx.AsyncClient() as client:
        # Get current weather
        response = await client.get(
            f"{OPENWEATHER_BASE_URL}/weather",
            params={
                "lat": lat,
                "lon": lng,
                "appid": OPENWEATHER_API_KEY,
                "units": "metric",
            },
        )
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        return data


def _get_mock_weather(lat: float, lng: float) -> dict[str, Any]:
    """Return mock weather data for development/fallback."""
    return {
        "coord": {"lon": lng, "lat": lat},
        "weather": [
            {
                "id": 801,
                "main": "Clouds",
                "description": "few clouds",
                "icon": "02d",
            }
        ],
        "main": {
            "temp": 28.5,
            "feels_like": 29.2,
            "temp_min": 26.0,
            "temp_max": 30.0,
            "pressure": 1013,
            "humidity": 65,
        },
        "visibility": 10000,
        "wind": {"speed": 4.5, "deg": 230},
        "clouds": {"all": 25},
        "dt": int(datetime.now().timestamp()),
        "sys": {
            "country": "IN",
            "sunrise": int(datetime.now().timestamp()) - 14400,
            "sunset": int(datetime.now().timestamp()) + 14400,
        },
        "timezone": 19800,
        "id": 0,
        "name": "Demo Location",
        "cod": 200,
    }
