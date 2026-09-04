#!/usr/bin/env bash
# Run Playwright e2e tests inside the official Playwright Docker image.
#
# Avoids `playwright install --with-deps` on the host, which would require
# sudo and adds ~500 MB of OS packages to the host. The image ships with
# Chromium and all its system dependencies pre-installed.
#
# Mounts the project at /work, runs `playwright test` via node directly
# (the image's pnpm refuses workspaces without a `packages` field, but
# node works fine), and reaches services on the host.
#
# Uses `--network host` so `localhost` inside the container is the
# host's localhost — no /etc/hosts gymnastics, no port mapping. This
# keeps URLs as `localhost` (which SvelteKit requires to skip the
# `Secure` cookie flag on plain HTTP).
#
# Bind-mounts the artifact dirs (./pw-test-results, ./playwright-report)
# onto the container so `actions/upload-artifact` in CI can find them
# after the run. Pre-creates them with mode 777 so the uid mismatch
# between the host user and the container's `pwuser` (typically both
# uid 1000, but GitHub Actions' `runner` is uid 1001) doesn't block
# writes inside the container.
#
# Relaxes the project-root perms to 777 for the duration of the run,
# restored on exit. The container's `pwuser` (uid 1000) needs write
# access to /work (the bind-mount target) in order to rmdir artifact
# subdirs during playwright's start-of-run cleanup. GitHub Actions'
# `runner` is uid 1001 and the project root defaults to mode 755 — too
# restrictive for the container's pwuser. chmod 777 is the cleanest
# local-only relaxation; it's reverted on script exit (success or fail).
#
# Required env (defaults in parens target the local Supabase stack):
#   PLAYWRIGHT_BASE_URL  — base URL the browser hits  (http://localhost:4173)
#   DATABASE_URL         — Postgres for globalSetup    (postgres://postgres:postgres@localhost:54322/postgres)
#   PUBLIC_SUPABASE_URL  — Supabase API for auth       (http://localhost:54321)
#   MAILPIT_URL          — Inbucket for OTP retrieval  (http://localhost:54324)
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${PLAYWRIGHT_DOCKER_IMAGE:-mcr.microsoft.com/playwright:v1.61.1-jammy}"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:4173}"
MAILPIT_URL_VALUE="${MAILPIT_URL:-http://localhost:54324}"
DATABASE_URL_VALUE="${DATABASE_URL:-postgres://postgres:postgres@localhost:54322/postgres}"
SUPABASE_URL_VALUE="${PUBLIC_SUPABASE_URL:-http://localhost:54321}"

# Pre-create artifact dirs on the host so the bind mount lands on a dir
# owned by the host user (not auto-created by docker as root). Mode 777
# lets the container's `pwuser` write regardless of host uid.
ARTIFACT_DIRS=(
  "${PROJECT_ROOT}/pw-test-results"
  "${PROJECT_ROOT}/playwright-report"
)
for d in "${ARTIFACT_DIRS[@]}"; do
  rm -rf "$d" 2>/dev/null || true
  mkdir -p "$d"
  chmod 777 "$d"
done

# Save the current project-root mode and widen to 777 so the container's
# pwuser can rmdir/mkdir subdirs under /work. Restored on exit.
ORIG_ROOT_PERMS=$(stat -c '%a' "${PROJECT_ROOT}")
chmod 777 "${PROJECT_ROOT}"
trap 'chmod "${ORIG_ROOT_PERMS}" "${PROJECT_ROOT}" 2>/dev/null || true' EXIT

docker run \
  --rm \
  --user pwuser \
  --network host \
  -v "${PROJECT_ROOT}:/work" \
  -v "${PROJECT_ROOT}/.svelte-kit:/work/.svelte-kit" \
  -v "${PROJECT_ROOT}/build:/work/build" \
  -v "${PROJECT_ROOT}/node_modules:/work/node_modules" \
  -v "${PROJECT_ROOT}/pw-test-results:/work/pw-test-results" \
  -v "${PROJECT_ROOT}/playwright-report:/work/playwright-report" \
  -w /work \
  -e "PLAYWRIGHT_BASE_URL=${BASE_URL}" \
  -e "DATABASE_URL=${DATABASE_URL_VALUE}" \
  -e "PUBLIC_SUPABASE_URL=${SUPABASE_URL_VALUE}" \
  -e "MAILPIT_URL=${MAILPIT_URL_VALUE}" \
  -e "CI=${CI:-}" \
  -e "PWDEBUG=${PWDEBUG:-}" \
  "${IMAGE}" \
  node node_modules/@playwright/test/cli.js test "$@"
