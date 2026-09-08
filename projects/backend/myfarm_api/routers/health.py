from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Unauthenticated liveness check — what CI and Render's health probe hit."""
    return {"status": "ok"}
