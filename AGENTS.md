# AGENTS.md

## Common commands and tools

`make start-all` to start all services and serve web page in production preview mode
`pnpm exec playwright test` to run playwright tests locally. Avoid using docker container on this machine unless debugging a discrepancy between docker run and bare metal run.
`gh` Github cli to access information about PRs, CI runs, etc

## Tests

Playwright tests run from `tests/e2e/`; reference (disabled) tests live in `tests/archive/`. Tests must not require reseeding — if they need recipes, create new ones with a uuid name. Bare-metal runs need `DATABASE_URL`, `PUBLIC_SUPABASE_URL`, `MAILPIT_URL`; sign in via `tests/e2e/helpers/auth.ts`.

Tests dependencies can be started with `just test-db-deps` and the frontend preview server can be started with `just preview`. The preview server watches and rebuilds whenever changes are made to the UI so restarting the preview server should not be necessary.

Tests should be run using `just test-e2e-run-headless` specifying a test file whenever possible.

### Test writing guidelines

Getters in `tests/e2e/helpers/page-utils.ts` should be used whenever possible. If a getter for an element doesn't already exist, add it first to `page-utils.ts`.

Add any common, application specific steps such as an openIngredientContextMenu or editDirection step, to the page utils if one is needed for the test but one doesn't already exist.

Direct writes to the database should be avoided where manual changes through the UI can be made.

### Troubleshooting

When /auth is unaccessible when running an e2e test, it usually means that the preview server isn't running.

## Documentation

Documentation lives in `docs/`. Project concepts are in [`docs/overview.md`](docs/overview.md); feature docs are in [`docs/features/`](docs/features/) (register new ones in `docs/features/README.md`); architectural decisions live in [`docs/adr/`](docs/adr/). Keep each feature doc tight: one-paragraph summary, behaviour bullets, Files footer. Update docs when features are added, changed, or removed.
