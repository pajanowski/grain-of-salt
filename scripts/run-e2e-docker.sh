#!/usr/bin/env bash
# Run Playwright e2e tests inside the official Playwright Docker image.
#
# Avoids `playwright install --with-deps` on the host, which would require
# sudo and adds ~500 MB of OS packages to the host. The image ships with
# Chromium and all its system dependencies pre-installed.
#
# Mounts the project at /work, runs `playwright test` via node directly
# (the image's pnpm refuses workspaces without a `packages` field, but
# node works fine), and reaches the preview server on the host.
#
# Required env:
#   PLAYWRIGHT_BASE_URL  — defaults to http://localhost:4173. We use
#                          `localhost` rather than `host.docker.internal`
#                          because SvelteKit marks cookies as `Secure`
#                          for any host other than literal `localhost`,
#                          and the browser refuses to store Secure
#                          cookies over plain HTTP. Mapping localhost to
#                          the host-gateway keeps both the cookie policy
#                          and the test's URL consistent.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${PLAYWRIGHT_DOCKER_IMAGE:-mcr.microsoft.com/playwright:v1.61.1-jammy}"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://host.docker.internal:4173}"

# Mailpit (Supabase OTP catcher). Inbucket ships in the supabase stack on
# the host, bound to 0.0.0.0:54324.
CONTAINER_MAILPIT_URL="http://localhost:54324"

docker run \
  --rm \
  --user pwuser \
  --add-host=host.docker.internal:host-gateway \
  -v "${PROJECT_ROOT}:/work" \
  -v "${PROJECT_ROOT}/.svelte-kit:/work/.svelte-kit" \
  -v "${PROJECT_ROOT}/build:/work/build" \
  -v "${PROJECT_ROOT}/node_modules:/work/node_modules" \
  -w /work \
  -e "PLAYWRIGHT_BASE_URL=${BASE_URL}" \
  -e "DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres" \
  -e "PUBLIC_SUPABASE_URL=http://localhost:54321" \
  -e "MAILPIT_URL=${CONTAINER_MAILPIT_URL}" \
  -e "CI=${CI:-}" \
  -e "PWDEBUG=${PWDEBUG:-}" \
  "${IMAGE}" \
  node node_modules/@playwright/test/cli.js test "$@"
