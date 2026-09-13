# AGENTS.md

## Common commands and tools

`just setup-dev` to bootstrap all services (install + supabase + db push/seed) then `just dev` to develop.
`pnpm exec playwright test` to run playwright tests locally. Avoid using docker container on this machine unless debugging a discrepancy between docker run and bare metal run.
`gh` Github cli to access information about PRs, CI runs, etc

## Tests

Playwright tests run from `tests/e2e/`; reference (disabled) tests live in `tests/archive/`. Tests must not require reseeding — if they need recipes, create new ones with a uuid name. Bare-metal runs need `DATABASE_URL`, `PUBLIC_SUPABASE_URL`, `MAILPIT_URL`; sign in via `tests/e2e/helpers/auth.ts`.

Agents should use `just agent-e2e <test-file>` for fully isolated test runs (builds, starts its own preview, runs tests, tears down). Use `just agent-e2e` with no args to run all tests.

### Test writing guidelines

Getters in `tests/e2e/helpers/page-utils.ts` should be used whenever possible. If a getter for an element doesn't already exist, add it first to `page-utils.ts`.

Add any common, application specific steps such as an openIngredientContextMenu or editDirection step, to the page utils if one is needed for the test but one doesn't already exist.

Direct writes to the database should be avoided where manual changes through the UI can be made.

### Troubleshooting

When errors occur in `auth.ts` or `global-setup.ts`, stop and wait for further instruction. Don't attempt to fix the issue. This requires manual intervention.

## Documentation

Documentation lives in `docs/`. Project concepts are in [`docs/overview.md`](docs/overview.md); feature docs are in [`docs/features/`](docs/features/) (register new ones in `docs/features/README.md`); architectural decisions live in [`docs/adr/`](docs/adr/). Keep each feature doc tight: one-paragraph summary, behaviour bullets, Files footer. Update docs when features are added, changed, or removed.
