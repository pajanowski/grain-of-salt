# Usage: just [-e JUSTFILE] [--justfile JUSTFILE] TARGET
# Run `just --list` to list all recipes.

# --- app ----------------------------------------------------------------------

install:
    pnpm install

dev:
    pnpm dev &

run: dev

build:
    pnpm build

preview:
    pnpm start

check:
    pnpm check

lint:
    pnpm lint

format:
    pnpm format

# --- startup flows -------------------------------------------------------------

# Default: build + preview production app
start: build preview

start-dev:
    pnpm dev

# Bootstrap from scratch: deps, supabase, push, seed, preview
start-all:
    #!/usr/bin/env bash
    if [ ! -d node_modules ]; then
        just install
    fi
    just db-up
    just db-push
    just db-seed
    just build
    just preview

# Hard reset + bootstrap
start-fresh:
    just install
    just db-up
    pnpm supabase db reset
    just db-push
    just db-seed
    just build
    just preview

start-status:
    pnpm db:status

# --- tests --------------------------------------------------------------------

test:
    pnpm test

test-unit:
    pnpm test:unit -- --run

test-watch:
    pnpm test:unit

test-db-deps:
    pnpm db:start
    pnpm db:push

playwright-install:
    pnpm exec playwright install --with-deps chromium

# db deps + dev server
test-deps: test-db-deps dev

# Run e2e in Docker (no host browser install needed)
# Builds, starts vite preview on port 4173, runs tests, then stops the server.
test-e2e *extra:
    #!/usr/bin/env bash
    set -e
    just build
    pnpm preview &
    PREVIEW_PID=$!
    # Wait for preview server to be ready
    for i in $(seq 1 30); do
        if curl -sf http://localhost:4173 > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
    pnpm test:e2e {{extra}} || { kill $PREVIEW_PID 2>/dev/null; exit 1; }
    kill $PREVIEW_PID 2>/dev/null

# Run e2e in browser UI mode (requires playwright-install)
test-e2e-ui *extra:
    DATABASE_URL='postgres://postgres:postgres@127.0.0.1:54322/postgres' \
    PUBLIC_SUPABASE_URL='http://127.0.0.1:54321' \
    MAILPIT_URL='http://127.0.0.1:54324' \
    pnpm exec playwright test --ui {{extra}}

# --- db ------------------------------------------------------------------------
# All DB state lives inside the local Supabase stack
# (https://supabase.com/docs/guides/local-development). It bundles
# Postgres + Auth (GoTrue) + Storage + Realtime + Mailpit (for OTP emails)
# + Studio. Drizzle owns the public.* schema; Supabase owns auth.*

db-up:
    pnpm db:start

db-down:
    pnpm db:stop

db-status:
    pnpm db:status

db-push:
    pnpm db:push

db-seed:
    pnpm db:seed

db-fresh: db-reset db-seed

db-reset:
    pnpm db:reset
    pnpm db:push
    pnpm db:seed

db-studio:
    pnpm db:studio

db-migrate:
    pnpm db:migrate

db-generate:
    pnpm db:generate

# --- legacy one-shots (run when migrating an older environment) ----------------

db-migrate-to-nodes:
    pnpm db:migrate-to-nodes

db-drop-legacy-tables:
    pnpm db:drop-legacy-tables
