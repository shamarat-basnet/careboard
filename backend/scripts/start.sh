#!/bin/sh
# Container entrypoint: apply migrations, seed (idempotent), then serve.
set -e

echo "Applying database migrations..."
alembic upgrade head

python -m app.seed.admin

if [ "${SEED_ON_STARTUP:-true}" = "true" ]; then
  python -m app.seed
fi

if [ "${RELOAD:-false}" = "true" ]; then
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app
fi
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers "${WEB_CONCURRENCY:-2}" --proxy-headers
