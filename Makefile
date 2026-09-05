# Usage:
#   make help         list available targets
#   make start        build + preview production app (default)
#   make start:all    bootstrap from scratch (deps, supabase, db, seed)
#   make start:fresh  hard reset + bootstrap
#   make db-fresh     drop, push schema, and re-seed
#   make test         run all tests

.PHONY: help
help:                              ## show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Targets:\n"} \
		/^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# --- app --------------------------------------------------------------------

.PHONY: install
install:                           ## install dependencies
	pnpm install

.PHONY: dev
dev:                               ## start the dev server
	pnpm dev

.PHONY: run
run: dev                           ## alias for `make dev`

.PHONY: build
build:                             ## production build
	pnpm build

preview:                           ## preview the production build (no build step)
	pnpm start

# --- one-shot startup flows ---------------------------------------------------
# These wrap the per-step targets above into a single command for new
# contributors and CI cold starts. Use:
#   make start            — build + preview the production app (default)
#   make start:dev        — vite dev
#   make start:all        — install + supabase up + db push + seed + preview
#   make start:fresh      — like start:all but drops + recreates the db first
#   make start:status     — print supabase stack status + service URLs

.PHONY: start start-dev start-all start-fresh start-status
start: build preview               ## build the production bundle and serve it
start-dev:                         ## vite dev (with --open)
	pnpm dev

# Skip install if node_modules already exists.
INSTALL_TARGET := $(shell test -d node_modules && echo skip-install || echo install)
start-all:                        ## bootstrap from scratch: deps, supabase, push, seed, preview
	@if [ "$(INSTALL_TARGET)" != "skip-install" ]; then $(MAKE) install; fi
	$(MAKE) db-up
	$(MAKE) db-push
	$(MAKE) db-seed
	$(MAKE) build
	$(MAKE) preview

start-fresh:                      ## hard reset: drop db, bootstrap, seed, preview
	$(MAKE) install
	$(MAKE) db-up
	pnpm supabase db reset
	$(MAKE) db-push
	$(MAKE) db-seed
	$(MAKE) build
	$(MAKE) preview

start-status:                     ## print supabase stack status + creds
	pnpm db:status

check:                             ## type-check the project
	pnpm check

.PHONY: lint
lint:                              ## lint and format-check
	pnpm lint

.PHONY: format
format:                            ## auto-format the source tree
	pnpm format

# --- tests ------------------------------------------------------------------

.PHONY: test
test:                              ## run unit + e2e tests
	pnpm test

.PHONY: test-unit
test-unit:                         ## run unit tests once
	pnpm test:unit -- --run

.PHONY: test-watch
test-watch:                        ## run unit tests in watch mode
	pnpm test:unit

.PHONY: test-deps
test-deps: db-up db-push            ## ensure supabase is up and the schema is applied (idempotent)

.PHONY: test-e2e
test-e2e:                          ## install playwright browsers and run e2e
 	pnpm test:e2e

.PHONY: test-e2e-ui
test-e2e-ui: test-deps             ## run playwright tests in UI mode against the local supabase stack
 	DATABASE_URL='postgres://postgres:postgres@127.0.0.1:54322/postgres' \
 	PUBLIC_SUPABASE_URL='http://127.0.0.1:54321' \
 	MAILPIT_URL='http://127.0.0.1:54324' \
 	pnpm exec playwright test --ui $(filter-out $@,$(MAKECMDGOALS))
# All DB state lives inside the local Supabase stack
# (https://supabase.com/docs/guides/local-development). It bundles
# Postgres + Auth (GoTrue) + Storage + Realtime + Mailpit (for OTP emails)
# + Studio. Drizzle owns the public.* schema; Supabase owns auth.*.

.PHONY: db-up
db-up:                             ## start the supabase local stack
	pnpm db:start

.PHONY: db-down
db-down:                           ## stop the supabase local stack
	pnpm db:stop

.PHONY: db-status
db-status:                         ## print supabase stack status + creds
	pnpm db:status

.PHONY: db-push
db-push:                           ## apply the drizzle schema to the db
	pnpm db:push

.PHONY: db-seed
db-seed:                           ## seed the dev db with sample recipes
	pnpm db:seed

.PHONY: db-fresh
db-fresh: db-reset db-seed         ## full reset + seed (drops data, reapplies schema, seeds)

.PHONY: db-reset
db-reset:                          ## drop + recreate the supabase db, then push schema + seed
	pnpm db:reset
	pnpm db:push
	pnpm db:seed

.PHONY: db-studio
db-studio:                         ## open drizzle studio against the dev db
	pnpm db:studio

.PHONY: db-migrate
db-migrate:                        ## run drizzle-kit migrate
	pnpm db:migrate

.PHONY: db-generate
db-generate:                       ## generate a drizzle migration file
	pnpm db:generate

# --- legacy one-shots (run when migrating an older environment) -------------

.PHONY: db-migrate-to-nodes
db-migrate-to-nodes:               ## migrate legacy ingredients/directions into recipe_nodes
	pnpm db:migrate-to-nodes

.PHONY: db-drop-legacy-tables
db-drop-legacy-tables:             ## drop the legacy ingredients/directions tables
	pnpm db:drop-legacy-tables
