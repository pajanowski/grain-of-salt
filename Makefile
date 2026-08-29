# Grain of Salt — developer commands.
#
# Usage:
#   make help         list available targets
#   make dev          start the dev server
#   make db-fresh     drop, push schema, and re-seed
#   make test         run all tests
#
# Package manager: pnpm.

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

.PHONY: preview
preview:                           ## preview the production build
	pnpm preview

.PHONY: check
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

.PHONY: test-e2e
test-e2e:                          ## install playwright browsers and run e2e
	pnpm test:e2e

# --- database ---------------------------------------------------------------
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
