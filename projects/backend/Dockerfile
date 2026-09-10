FROM python:3.12-slim

WORKDIR /app

# Layer the dependency install separately from app code so a code-only
# change doesn't reinstall every package.
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

COPY myfarm_api ./myfarm_api
COPY alembic.ini ./
COPY migrations ./migrations

# Render sets $PORT; default it for local `docker run`.
ENV PORT=8000
EXPOSE 8000

# Render runs a native Python buildpack, not this image (BACKEND_PLAN.md
# §3.2) — but keep the two in step: `alembic upgrade head` before uvicorn,
# same as the buildpack start command. `upgrade head` is a fast no-op once
# the schema is current.
CMD ["sh", "-c", "alembic upgrade head && uvicorn myfarm_api.main:app --host 0.0.0.0 --port ${PORT}"]
