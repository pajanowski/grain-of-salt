# Usage: just [-e JUSTFILE] [--justfile JUSTFILE] TARGET
# Run `just --list` to list all recipes.
# Unlisted DB action? Fall back to `pnpm db:<sub>` (see package.json).

# --- app ----------------------------------------------------------------------

install:
    pnpm install

# --- human --------------------------------------------------------------------

# Bootstrap once: install + supabase start + db push + seed.
# Then `dev` to develop. Stop supabase with `db-down`.
setup-dev: install _supabase-start db-push
    pnpm db:seed

_supabase-start:
    supabase start
    sleep 5

# Start local dev server (requires supabase running).
# If supabase isn't started yet, run `just setup-dev` first.
dev:
    pnpm dev

# Build + preview production build (one-shot or `vite build --watch`).
preview:
    pnpm start

build:
    pnpm build

# --- test-deps ----------------------------------------------------------------

# Start Docker Compose DB dependencies (Postgres + Mailpit etc.) needed for e2e.
test-deps:
    pnpm db:start
    pnpm db:push

# --- db thin wrappers ---------------------------------------------------------
# Kept so setup-dev depends on them cleanly.
# For ad-hoc work, prefer `pnpm db:<sub>` — it lists every option.

db-push:
    pnpm db:push

db-up:
    pnpm db:start

db-down:
    pnpm db:stop

db-seed:
    pnpm db:seed

db-reset:
    pnpm db:reset
    pnpm db:push
    pnpm db:seed

db-status:
    pnpm db:status

# --- e2e (human & agent share supabase stack) ---------------------------------
# Tests connect to human-dev's supabase (:54322 / :54321).
# Each test session gets its own TEST_USER_ID with UUID-scoped data.
# Human dev uses :5173, tests hit :4173 — no port collision.
# Global-setup provisions users and clones demo data so tests never conflict.

# Headless e2e — uses pnpm test:e2e (Docker).
# Env vars point to standard ports; override per-run via CLI.
test-e2e *extra:
    DATABASE_URL="postgres://postgres:postgres@localhost:54322/postgres" \
    PUBLIC_SUPABASE_URL="http://localhost:54321" \
    MAILPIT_URL="http://localhost:54324" \
    PLAYWRIGHT_BASE_URL="http://localhost:4173" \
    pnpm exec playwright test {{extra}}

# E2e in UI mode (requires installed browsers).
test-e2e-ui:
    DATABASE_URL="postgres://postgres:postgres@localhost:54322/postgres" \
    PUBLIC_SUPABASE_URL="http://localhost:54321" \
    MAILPIT_URL="http://localhost:54324" \
    PLAYWRIGHT_BASE_URL="http://localhost:4173" \
    pnpm exec playwright test --ui

# --- agent --------------------------------------------------------------------
# Runs e2e tests sharing human-dev's supabase stack.
# Fully isolated from human-dev workflow:
#   1. startup: build + start preview on :4173 (PID tracked for teardown).
#   2. test: run e2e tests against shared supabase.
#   3. teardown: kill preview — human-dev unaffected.
#
# Convenience alias that runs the full startup → test → teardown cycle.
agent-e2e *extra:
    just agent-e2e-startup && just agent-e2e-test {{extra}} && just agent-e2e-teardown

# Phase 1: build production bundle, start db deps, then start preview server.
agent-e2e-startup:
    just build
    just test-deps
    just agent-e2e-preview

# Phase 2: run e2e tests against shared supabase stack.
# Reads the preview port that agent-e2e-preview recorded.
# Usage: just agent-e2e-test tests/e2e/login.e2e.ts   (omit for all tests)
agent-e2e-test *extra:
    #!/usr/bin/env bash
    set -e
    PREVIEW_PORT=$(cat /tmp/grain-of-salt-agent-preview.port 2>/dev/null || echo 4173)
    DATABASE_URL="postgres://postgres:postgres@localhost:54322/postgres" \
    PUBLIC_SUPABASE_URL="http://localhost:54321" \
    MAILPIT_URL="http://localhost:54324" \
    PLAYWRIGHT_BASE_URL="http://localhost:$PREVIEW_PORT" \
    pnpm exec playwright test {{extra}}

# Phase 3: tear down agent — stop preview, clean up PID. Does NOT touch supabase.
agent-e2e-teardown:
    cat /tmp/grain-of-salt-agent-preview.pid 2>/dev/null | xargs kill 2>/dev/null || true
    rm -f /tmp/grain-of-salt-agent-preview.pid /tmp/grain-of-salt-agent-preview.port
    pnpm db:reset

# Preview server for agent — pid + port tracked for teardown.
agent-e2e-preview:
    #!/usr/bin/env bash
    set -e
    # Kill any stale preview
    if [ -f /tmp/grain-of-salt-agent-preview.pid ]; then
        kill $(cat /tmp/grain-of-salt-agent-preview.pid) 2>/dev/null || true
        rm -f /tmp/grain-of-salt-agent-preview.pid /tmp/grain-of-salt-agent-preview.port
    fi
    # Start preview and record PID
    pnpm preview --port 4173 &
    echo $! > /tmp/grain-of-salt-agent-preview.pid
    echo 4173 > /tmp/grain-of-salt-agent-preview.port
    # Wait for server to be ready
    for i in $(seq 1 30); do
        if curl -sf "http://localhost:4173" > /dev/null 2>&1; then
            echo "Preview up on :4173"
            exit 0
        fi
        sleep 1
    done
    kill $(cat /tmp/grain-of-salt-agent-preview.pid) 2>/dev/null || true
    exit 1
