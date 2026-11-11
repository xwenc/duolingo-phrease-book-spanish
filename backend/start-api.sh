#!/bin/sh
set -eu
cd "$(dirname "$0")"
# Upgrade schema before serving requests; never synchronize seed data here.
python -m alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --limit-concurrency 32 "$@"
