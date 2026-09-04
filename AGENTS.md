# AGENTS.md

## Common commands and tools

`make start-all` to start all services and serve web page in production preview mode
`pnpm exec playwright test` to run playwright tests locally. Avoid using docker container on this machine unless debugging a discrepancy between docker run and bare metal run.
`gh` Github cli to access information about PRs, CI runs, etc

## Tests

Playwright tests run from `tests/e2e/`; reference (disabled) tests live in `tests/archive/`. Tests must not require reseeding — if they need recipes, create new ones with a uuid name. Bare-metal runs need `DATABASE_URL`, `PUBLIC_SUPABASE_URL`, `MAILPIT_URL`; sign in via `tests/e2e/helpers/auth.ts`.

## Documentation

Documentation lives in `docs/`. Project concepts are in [`docs/overview.md`](docs/overview.md); feature docs are in [`docs/features/`](docs/features/) (register new ones in `docs/features/README.md`); architectural decisions live in [`docs/adr/`](docs/adr/). Keep each feature doc tight: one-paragraph summary, behaviour bullets, Files footer. Update docs when features are added, changed, or removed.
