from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, sourced from environment variables.

    Nothing here is a secret by itself — it's just where the process finds
    its secrets (a DB URL, a service-account path). Actual values come from
    GitHub Actions secrets in CI and Render's env vars in production; see
    ``BACKEND_PLAN.md`` §11.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"

    # Neon's pooled endpoint (the "-pooler" host). See BACKEND_PLAN.md §4:
    # pool_size=5, max_overflow=0 — a 0.1-CPU Render instance can't use more.
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/myfarm"
    db_pool_size: int = 5
    db_max_overflow: int = 0

    # Firebase Auth verifies ID tokens against the project's public keys —
    # only the project id is needed for verification, not a service account,
    # unless later work needs the Admin SDK for something privileged.
    firebase_project_id: str = ""

    # HS256 signing key for backend-issued PIN session tokens (issue #45).
    # No default in production — a blank secret makes `/api/v1/auth/session`
    # and `/api/v1/auth/register` refuse to issue tokens. Set on Render and
    # in CI (see .github/workflows/backend.yml).
    session_jwt_secret: str = ""
    session_jwt_ttl_seconds: int = 24 * 60 * 60

    # Comma-separated allowlist. The GitHub Pages origin in production;
    # localhost during development.
    cors_origins: str = "http://localhost:4200"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
