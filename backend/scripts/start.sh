#!/bin/sh
set -eu

MODE="${1:-start}"

echo "[startup] Running database migrations..."
attempt=1
max_attempts="${MIGRATION_MAX_ATTEMPTS:-20}"
until node scripts/migrate.js; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[startup] Migrations failed after ${attempt} attempts."
    exit 1
  fi
  echo "[startup] Migration attempt ${attempt} failed. Retrying in 3s..."
  attempt=$((attempt + 1))
  sleep 3
done

echo "[startup] Migrations complete. Starting backend (${MODE})..."
if [ "$MODE" = "dev" ]; then
  exec npx nodemon src/server.js
fi

exec node src/server.js
