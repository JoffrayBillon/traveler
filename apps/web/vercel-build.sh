#!/bin/sh
set -eu

cd ../..

pnpm build --filter=@traveler/web...

should_migrate=false
if [ "${VERCEL_ENV:-}" = "production" ] || \
  [ "${VERCEL_GIT_COMMIT_REF:-}" = "dev" ] || \
  [ -n "${TURSO_DATABASE_URL:-}" ] || \
  [ -n "${TURSO_AUTH_TOKEN:-}" ]; then
  should_migrate=true
fi

if [ "$should_migrate" = true ]; then
  if [ -z "${TURSO_DATABASE_URL:-}" ] || [ -z "${TURSO_AUTH_TOKEN:-}" ]; then
    echo "Both Turso database variables are required for this deployment." >&2
    exit 1
  fi

  pnpm --filter @traveler/api db:migrate
fi
