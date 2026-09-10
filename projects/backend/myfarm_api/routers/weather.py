"""Weather endpoints."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query

from myfarm_api.core.security import FirebaseIdentity, get_firebase_identity
from myfarm_api.core.weather import get_weather
from myfarm_api.schemas.weather import WeatherResponse

router = APIRouter(prefix="/api/v1/weather", tags=["weather"])


@router.get("", response_model=WeatherResponse)
async def get_weather_data(
    lat: Decimal = Query(..., description="Latitude"),
    lng: Decimal = Query(..., description="Longitude"),
    identity: FirebaseIdentity = Depends(get_firebase_identity),
) -> WeatherResponse:
    """Get weather for coordinates (tenant-scoped by Firebase token).

    Returns cached data if available, falls back to mock data if API unavailable.
    """
    if not lat or not lng:
        raise HTTPException(status_code=400, detail="lat and lng are required")

    try:
        weather = await get_weather(lat, lng)
        return WeatherResponse(**weather)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch weather: {str(e)}")
