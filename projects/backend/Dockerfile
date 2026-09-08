FROM python:3.12-slim

WORKDIR /app

# Layer the dependency install separately from app code so a code-only
# change doesn't reinstall every package.
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

COPY myfarm_api ./myfarm_api
# alembic.ini and alembic/ land in Stage 3 with the first domain model —
# nothing to migrate yet.

# Render sets $PORT; default it for local `docker run`.
ENV PORT=8000
EXPOSE 8000

# Single worker: the free-tier instance this targets (BACKEND_PLAN.md §3.2)
# has 0.1 CPU — more workers would just contend for it, not add throughput.
CMD ["sh", "-c", "uvicorn myfarm_api.main:app --host 0.0.0.0 --port ${PORT}"]
