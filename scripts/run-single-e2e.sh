#!/usr/bin/env bash
# Run a single Playwright test against the running host preview server,
# inside the Playwright Docker container. Use for fast iteration on auth
# or recipe flows without running the full suite.
#
# Requires:
#   - Supabase local stack running (`pnpm db:start`)
#   - Preview server running on 127.0.0.1:4173:
#       pnpm build && nohup pnpm preview --port 4173 --host &> /tmp/preview.log &
#
# Usage:
#   scripts/run-single-e2e.sh tests/e2e/recipe-actions.e2e.ts --grep "rename modal"
#   scripts/run-single-e2e.sh tests/e2e/codegen-repro.e2e.ts
set -euo pipefail

TEST_FILE="${1:?Test file required}"
shift

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="mcr.microsoft.com/playwright:v1.61.1-jammy"

docker run \
  --rm \
  --add-host=host.docker.internal:host-gateway \
  --add-host=localhost:host-gateway \
  -v "${PROJECT_ROOT}:/work" \
  -v "${PROJECT_ROOT}/.svelte-kit:/work/.svelte-kit" \
  -v "${PROJECT_ROOT}/build:/work/build" \
  -v "${PROJECT_ROOT}/node_modules:/work/node_modules" \
  -w /work \
  -e "PLAYWRIGHT_BASE_URL=http://host.docker.internal:4173" \
  -e "DATABASE_URL=postgres://postgres:postgres@host.docker.internal:54322/postgres" \
  -e "PUBLIC_SUPABASE_URL=http://host.docker.internal:54321" \
  -e "MAILPIT_URL=http://host.docker.internal:54324" \
  "${IMAGE}" \
  node node_modules/@playwright/test/cli.js test "$TEST_FILE" "$@"
