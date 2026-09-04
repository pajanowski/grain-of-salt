# Demo data

`scripts/seed.ts` populates a small recipe tree under `DEMO_USER_ID` so
a fresh install has content to explore. Reseeding clears `recipe_nodes`
and repopulates it; the script is idempotent.

## Tree

- **Simple Omelette** (root) — butter, salt, cheese.
- **Denver Omelette** (child of Simple) — adds ham, pepper, onion.
- **French Omelette** (child of Denver) — edits butter, removes
  cheese/ham/pepper/onion, adds chives.
- **Cheese Omelette** (child of Simple) — adds extra cheese.

## When it runs

- Manual: `pnpm db:seed` or `make db-seed`.
- Tests: `tests/e2e/global-setup.ts` re-runs the seed once per suite,
  then clones the demo tree under `TEST_USER_ID` with fresh ids.

## Files

- `scripts/seed.ts` — seed script
- `src/lib/server/db/schema.ts` — `DEMO_USER_ID` constant
- `tests/e2e/global-setup.ts` — one-time seed + clone
