#!/bin/sh
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-wms}"

if [ -n "${DB_PASSWORD:-}" ]; then
  export PGPASSWORD="${DB_PASSWORD}"
fi

echo "Waiting for database to be ready..."
until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; do
  sleep 1
done
echo "Database is ready."

echo "Ensuring uploads directory exists..."
mkdir -p public/uploads

if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs public/uploads 2>/dev/null || true
  chmod -R 775 public/uploads 2>/dev/null || true
fi

echo "Starting application..."
exec su-exec nextjs:nodejs node server.js
