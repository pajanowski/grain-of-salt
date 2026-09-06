# Demo mode plan

Development plan for [ADR 0003 — Demo Mode](../adr/0003-demo-mode.md).
The ADR captures the *what* and the *why*; this doc captures the
acceptance criteria, the test strategy, and the work breakdown that
the implementation has to satisfy.

## Scope

Deliver the demo-mode architecture from the ADR and prove it with two
Playwright e2e suites:

- **Non-demo suite** — the existing app against the local Supabase
  stack. Validates that the refactor (dispatch functions, `RecipeStore`
  interface, Supabase adapter wrapping the existing `api` axios
  pipeline) preserves every behaviour the current tests pin.
- **Demo suite** — the same UI against `VITE_DEMO_MODE=1`, with no
  Supabase running. Validates the demo adapter end-to-end: detection,
  seed load, create / rename / fork / delete / saveNode, localStorage
  persistence, reset.

The two suites exercise the same user-facing flows against the two
`RecipeStore` implementations.

## Requirements

### 1. Two Playwright e2e test suites

The implementation is **not** accepted until both suites exist and are
green in CI.

#### 1a. Non-demo suite (existing — must stay green)

- `tests/e2e/recipe-create.e2e.ts`
- `tests/e2e/recipe-edit-changes.e2e.ts`
- Continue to require `DATABASE_URL`, `PUBLIC_SUPABASE_URL`, `MAILPIT_URL`
  and the local Supabase stack, exactly as today. `globalSetup` keeps
  seeding + cloning.
- Every test in these files is a regression test for the
  Supabase-backed path: `RecipeStore.getRecipeStore()` returns the
  Supabase adapter; `dispatch` functions call into the existing
  `api.*` axios pipeline; load functions read through the stub-free
  real client.
- The `api.ts` axios instance is **not** deleted and is still used
  internally by the Supabase adapter. Mechanical refactor only — no
  behavioural change observable from these tests.

#### 1b. Demo suite (new — must not require Supabase)

- New `tests/e2e/recipe-create.demo.e2e.ts` and
  `tests/e2e/recipe-edit-changes.demo.e2e.ts` covering the same flows
  as the non-demo suite but with `VITE_DEMO_MODE=1` set on the preview
  server (or any equivalent test fixture mechanism — see "How the demo
  suite activates demo mode" below).
- These tests MUST run to green with **no** `DATABASE_URL`,
  `PUBLIC_SUPABASE_URL`, or `MAILPIT_URL` set. The demo suite must
  pass against `pnpm preview` on a host with no Supabase stack running.
- The demo suite is hermetic — it resets `localStorage` in
  `test.beforeEach` and clears any storage state captured by
  `globalSetup` so the test browser starts blank (or, equivalently, it
  runs the demo-mode `Reset demo` button before each test).
- The demo suite must sign in **without** the OTP flow (the demo
  `/auth` page skips OTP) and must never hit `/auth` itself.

### 2. Coverage parity (minimum)

The demo suite MUST cover at least the following flows with passing
assertions:

- App loads on `demo.local` (or any hostname when `VITE_DEMO_MODE=1`)
  without 500s and renders the seeded recipe tree.
- A recipe created via the inline create form appears in the list
  immediately (no `invalidateAll()` round-trip) and survives a hard
  reload (localStorage-backed).
- Renaming a recipe via the existing rename UI updates the link in the
  tree and persists across reload.
- Deleting a recipe removes its link from the tree and persists.
- Forking a recipe produces a new recipe whose name ends in `(fork)`
  and whose nodes have new IDs (edits to the fork do not affect the
  source — verifiable by opening both before and after an edit).
- Adding an ingredient / direction and saving writes through to
  localStorage and survives a reload.
- The "Reset demo" button clears localStorage and restores the seed.

The non-demo suite continues to cover the same flows against the real
backend. If the demo suite adds a flow the non-demo suite doesn't have
(only the reset button is a candidate), that flow needs an explicit
explanation in the PR — no silent divergence.

### 3. How the demo suite activates demo mode

The activation mechanism is part of the deliverable. Pick one and pin
it in the test config:

- **Option A — separate Playwright project** with `baseURL` set to a
  preview server launched with `VITE_DEMO_MODE=1` and no Supabase env.
  Two `projects[]` entries in `playwright.config.ts`; CI runs both.
- **Option B — shared preview, per-suite storage state + URL param /
  cookie** that the `+layout.server.ts` consults alongside the
  hostname check. More fragile; only viable if option A breaks the
  preview-only contract.

The plan assumes option A. A separate `webServer` / `webServer`
override is **not** needed if the demo preview is launched externally
by the same script that starts the non-demo preview.

### 4. No Supabase stack required for the demo suite

Concretely:

- `tests/e2e/global-setup.ts` is **not** invoked for the demo project
  (override `globalSetup` to a no-op in the demo project, or factor the
  demo project as a `globalSetup: undefined`).
- The demo suite's storage state is empty (`storageState: undefined`).
- The runner script (`scripts/run-e2e-docker.sh` or a sibling) must
  accept invocation without `DATABASE_URL`, `PUBLIC_SUPABASE_URL`,
  `MAILPIT_URL`. Those vars become optional; when unset, the demo
  project is the only runnable one and CI should run it on a node with
  no Supabase service.
- Document the no-Supabase run in CI: a job (e.g. `e2e-demo`) that
  runs the docker image with no service containers and only the demo
  project. No docker-compose service dependency.

### 5. Detection — `isDemoMode` / `isDemoHost`

Pinned behaviour the demo suite relies on:

- Visiting `/` on a `demo.*` hostname with `VITE_DEMO_MODE=1` renders
  the demo layout (no real Supabase call, `data.demoMode === true`).
- Visiting `/` on `localhost` without the env flag renders the real
  layout (`data.demoMode === false`). The non-demo suite continues to
  pass on `localhost` with Supabase.
- Visiting `/auth` in demo mode redirects to `/` without showing the
  OTP form, regardless of whether `safeGetSession` would otherwise
  return a user.

### 6. Refactor seam — `RecipeStore` / dispatch functions

Implementation invariant the non-demo suite enforces:

- The Supabase adapter returns the same shapes (`RecipeSummary`,
  `RecipeTree`) the existing load functions and components expect. No
  shape changes observable through the UI.
- The dispatch functions in `src/lib/recipes.ts` (`createRecipe`,
  `renameRecipe`, `forkRecipe`, `deleteRecipe`, `saveNodeChanges`,
  `loadRecipeTree`) replace `api.*` call sites in components. The
  non-demo suite is the contract that proves the components still
  behave identically.

### 7. Stub Supabase client

- `makeStubSupabase()` in `src/lib/supabase-stub.ts` implements every
  method any existing `+page.server.ts` load function calls. Coverage
  is sufficient when the demo suite loads every demo-eligible route
  without throwing. Add methods as the demo suite surfaces them.
- `safeGetSession` in demo mode returns `DEMO_USER`. The demo suite
  must not depend on any real Supabase auth call.

### 8. Documentation

- New `docs/features/demo-mode.md` (per the ADR's file table) covering
  the user-facing demo experience: what the visitor sees, the reset
  button, the no-account guarantee.
- Update `docs/features/README.md` to link the new feature doc under
  User-facing.
- Update `AGENTS.md` if the demo-suite runner script / CI matrix
  changes the documented commands.

## Work breakdown

Ordered so each step leaves the repo in a runnable state.

### Phase 1 — Refactor seam (no behavioural change)

- Introduce `src/lib/recipe-store.ts` with the `RecipeStore`
  interface and the two implementations side by side:
  `recipe-store.supabase.ts` wraps the existing `api.*` handlers;
  `recipe-store.demo.ts` is the in-memory / localStorage adapter.
- Add `getRecipeStore()` returning the Supabase adapter on the server
  and the client depending on `isDemoMode()`.
- Add `src/lib/recipes.ts` dispatch functions. Migrate each component
  call site mechanically.
- **Checkpoint:** the non-demo suite is green. The demo store exists
  but is unreferenced. This is the safety net — every subsequent
  change is validated by the demo suite.

### Phase 2 — Demo detection + SSR stub

- `src/lib/demo-init.ts` (`isDemoMode`, `isDemoHost`).
- `src/lib/supabase-stub.ts` returning empty results.
- `src/hooks.server.ts`: demo branch installs stub supabase +
  `DEMO_USER` `safeGetSession`.
- `src/routes/+layout.server.ts`: demo branch returns empty tree +
  `demoMode: true`.
- `src/routes/auth/+page.server.ts`: skip OTP form in demo mode.
- **Checkpoint:** the demo preview server boots without Supabase env
  and renders the home page without 500s (manual smoke). The non-demo
  suite is green.

### Phase 3 — Demo adapter + seed + client takeover

- `src/lib/demo-seed.ts` static fixtures.
- `src/lib/recipe-store.demo.ts` wired to `demoRecipes` / `demoNodes`
  writables, localStorage persistence, `forkRecipe` semantics.
- `src/routes/+layout.svelte` mounts the demo store on
  `data.demoMode` and gates the "Reset demo" button.
- Recipe list component reads from the active store (or dispatch
  function transparently picks the right adapter — implementation
  choice).
- **Checkpoint:** manual smoke against the demo preview server
  exercises every recipe CRUD flow with reloads. Non-demo suite still
  green.

### Phase 4 — Demo Playwright suite + CI split

- Add `tests/e2e/recipe-create.demo.e2e.ts` and
  `tests/e2e/recipe-edit-changes.demo.e2e.ts` mirroring the non-demo
  flows against the demo preview server.
- Add a Playwright project in `playwright.config.ts` for the demo
  suite (`globalSetup: undefined`, empty `storageState`, baseURL
  pointing at the demo preview).
- Update the docker runner script (or add a sibling) so the demo
  project can be invoked without `DATABASE_URL`,
  `PUBLIC_SUPABASE_URL`, `MAILPIT_URL`.
- Add CI jobs:
  - `e2e-non-demo` — current job, unchanged env, runs the non-demo
    project.
  - `e2e-demo` — runs the demo project with no Supabase service.
- **Checkpoint:** both suites green in CI; demo suite green locally
  with Supabase stopped.

### Phase 5 — Docs

- `docs/features/demo-mode.md`.
- Update `docs/features/README.md`.
- Touch `AGENTS.md` if the runner commands changed.

## Out of scope

- Real auth in demo mode (always `DEMO_USER`).
- Migration of seed data between demo deployments (localStorage is
  per-browser by design).
- Replacing the existing `api.ts` axios pipeline — it stays; the
  Supabase adapter wraps it.
- Loading-state / spinner polish beyond what the existing tests pin.

## Acceptance gate

The demo-mode feature ships only when **all** of the following hold:

- Non-demo Playwright suite (`recipe-create.e2e.ts`,
  `recipe-edit-changes.e2e.ts`) is green in CI on the current
  Supabase-backed preview.
- Demo Playwright suite (the two new `*.demo.e2e.ts` files) is green
  in CI on a preview server with `VITE_DEMO_MODE=1` and no Supabase
  env vars set.
- Demo suite passes locally with `pnpm db:stop` and
  `VITE_DEMO_MODE=1 pnpm build && VITE_DEMO_MODE=1 pnpm preview`.
- `docs/features/demo-mode.md` exists and is linked from
  `docs/features/README.md`.
