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
    SINGLE_USER_MODE="true" pnpm dev

# Build + preview production build (one-shot or `vite build --watch`).
preview:
    pnpm preview 

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
# Tests connect to supabase (:54322 / :54321).
# Each test session gets its own TEST_USER_ID with UUID-scoped data.
# Human dev uses :5173, tests hit :4173 — no port collision.
# Playwright manages the preview webServer lifecycle natively.
# Global-setup provisions users, verifies service health, and captures auth tokens.

# Headless e2e
test-e2e *extra:
    fuser -k 4173/tcp 2>/dev/null || true
    pnpm build
    DATABASE_URL="postgres://postgres:postgres@localhost:54322/postgres" \
    PUBLIC_SUPABASE_URL="http://localhost:54321" \
    MAILPIT_URL="http://localhost:54324" \
    SINGLE_USER_MODE="false" \
    pnpm exec playwright test {{extra}}

# E2e in UI mode (requires installed browsers).
test-e2e-ui *extra:
    fuser -k 4173/tcp 2>/dev/null || true
    pnpm build
    DATABASE_URL="postgres://postgres:postgres@localhost:54322/postgres" \
    PUBLIC_SUPABASE_URL="http://localhost:54321" \
    MAILPIT_URL="http://localhost:54324" \
    SINGLE_USER_MODE="false" \
    pnpm exec playwright test --ui {{extra}}

# --- agent --------------------------------------------------------------------
# Runs e2e tests sharing supabase stack with automatic webServer lifecycle.
# Usage: just agent-e2e tests/e2e/recipe-create.e2e.ts  (omit for all tests)
agent-e2e *extra:
    fuser -k 4173/tcp 2>/dev/null || true
    pnpm build
    DATABASE_URL="postgres://postgres:postgres@localhost:54322/postgres" \
    PUBLIC_SUPABASE_URL="http://localhost:54321" \
    MAILPIT_URL="http://localhost:54324" \
    SINGLE_USER_MODE="false" \
    pnpm exec playwright test {{extra}}

# Compatibility wrappers
agent-e2e-test *extra:
    just agent-e2e {{extra}}

agent-e2e-startup: build test-deps

agent-e2e-teardown: db-reset
