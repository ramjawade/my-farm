from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from myfarm_api.core.config import get_settings
from myfarm_api.core.db import get_engine
from myfarm_api.routers import activities, auth, crops, farms, health, lands, me, reference
from myfarm_api.schemas.common import ProblemDetail


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await get_engine().dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="MyFarm API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(HTTPException)
    async def problem_detail_handler(request: Request, exc: HTTPException) -> JSONResponse:
        # RFC 9457: one error shape for every endpoint (BACKEND_PLAN.md §7).
        problem = ProblemDetail(
            title=exc.detail if isinstance(exc.detail, str) else "Error",
            status=exc.status_code,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=problem.model_dump(),
            media_type="application/problem+json",
            headers=exc.headers,
        )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(reference.router)
    app.include_router(me.router)
    app.include_router(farms.router)
    app.include_router(lands.router)
    app.include_router(crops.router)
    app.include_router(activities.router)

    return app


app = create_app()
