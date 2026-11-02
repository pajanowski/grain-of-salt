# Demo Mode

Client-side sandbox environment allowing visitors to explore, create, edit, fork, delete, and favorite recipes without authentication or backend database infrastructure. All state is maintained in browser `localStorage` and seeded from static fixtures on initial visit.

## Behaviour

- **Subdomain & Flag Activation:** Activated on any hostname starting with `demo.` (such as `demo.grainofsalt.app` or `demo.local:5173`) or when `VITE_DEMO_MODE=1` is set.
- **Zero-Login Access:** Direct access to `/mise` and `/mise/recipes/[slug]` without auth gates or OTP emails.
- **Home Screen Entry:** Direct "Try Demo" option on the landing page next to the Sign in action.
- **Full DAG & Mutation Capabilities:** Supports creating recipes, replaying materialized ingredient/direction changes, forking revisions, renaming roots, deleting recipe trees, and toggling favorite bookmarks.
- **Local Persistence:** All mutations persist in browser `localStorage` under `demo:recipes` and `demo:nodes`, surviving browser refreshes and tab reloads.
- **Reset Demo State:** Clicking "Reset Demo" in the top banner or sidebar restores the canonical demo seed fixtures immediately.
- **SSR Safety:** Server hooks and loaders detect demo requests, attach a stub Supabase client, and safely render layout baseline shells without making external network or database queries.

## Files

- `src/lib/demo-init.ts` — Client/server hostname and environment detection
- `src/lib/demo-seed.ts` — Canonical recipe and node seed fixtures
- `src/lib/recipe-store.ts` — `RecipeStore` interface definition
- `src/lib/recipe-store.demo.ts` — Client-side localStorage adapter
- `src/lib/supabase-stub.ts` — Stub Supabase client for SSR
- `src/lib/api.ts` — Store and HTTP dispatch client
- `src/hooks.server.ts` — Server handle hook configuring demo session and stub client
- `src/routes/mise/+layout.svelte` — Demo banner and Reset Demo trigger
- `tests/e2e/demo-mode.e2e.ts` — End-to-end Playwright tests on `demo.localhost`
