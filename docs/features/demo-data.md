# Demo data

`scripts/seed.ts` populates a small recipe tree under `DEMO_USER_ID` so
a fresh install has content to explore. Reseeding clears `recipe_nodes`
and repopulates it; the script is idempotent.

## Tree

Two families:

**Omelette family** — Simple Omelette (root) → French Omelette (child of
Simple: butter, chives, low heat) and Cheese Omelette (child of Simple:
cheddar) → Denver Omelette (child of Cheese: ham, pepper, onion).

**Bouillabaisse family** — "Auguste's Bouillabaisse" (root, imported from
`marmiton.org`, 16 ingredients / 8 directions with `#ingredient-uuid`
references) → Weeknight (frozen seafood mix + potato) → with Rouille
(baguette + mayo) → fork into One-Pot (removes the rouille) and Spicy
(red pepper flakes) → Provençal (herbes de Provence) → for Two (halved
quantities). The fork gives the graph and log views a branch shape.

## When it runs

- Manual: `pnpm db:seed` or `make db-seed`.
- In-app: the "Seed sample recipes" button on the account page
  (`/mise/api/seed` → `seedForUser`).
- Tests: `tests/e2e/global-setup.ts` re-runs the seed once per suite,
  then clones the demo tree under `TEST_USER_ID` with fresh ids.

## Files

- `scripts/seed.ts` — seed script
- `src/lib/server/db/schema.ts` — `DEMO_USER_ID` constant
- `tests/e2e/global-setup.ts` — one-time seed + clone
