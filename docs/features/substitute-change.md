# Substitute change type and descendant substitutes

The substitute change type is a label-only synonym for `edit` — the same
wire shape (`targetId` + `body`) and the same materialize behavior, but the
row renders with a blue `SUB` badge and a dedicated kebab-menu item.

When viewing any recipe node, the descendants of that node that carry a
substitute change are surfaced per-row: each substituted row renders a
"Subs: N" chip next to its note icon. Clicking the chip opens a slide-out
sidebar listing every descendant substitute for that specific row, with
the substituted content and a link back to the source descendant node.

## Behavior

- The Substitute kebab-menu item opens the same edit form as Edit. The
  only difference is which changeType label the leaf emits on save.
- Substitute changes render in three places with a blue (`bg-blue-100`)
  background and the `SUB` prefix instead of `EDIT`:
  - `NodeChanges` (`src/lib/component/NodeChanges.svelte`)
  - `RecipeHistory` (`src/lib/component/RecipeHistory.svelte`)
  - Graph `RecipeNodeCard` (`src/lib/component/RecipeNodeCard.svelte`)
- All three expose `data-change-type="substitute"` for testing.
- Per-row "Subs: N" chip on every ingredient / direction row that has at
  least one descendant substitute. Click opens the substitutes sidebar.
- The descendant substitution crawler (`findDescendantSubstitutes` in
  `src/lib/server/bo/recipenodesbo.ts`) walks the chain via `parent_id`
  for every descendant whose substitute `targetId` matches a row
  visible at the root node. Returns `{ flat, byRowId, byRowKind }` so the
  sidebar can filter by the clicked row id. The crawler is
  ownership-scoped.
- The chip persists even after the user substitutes the row themselves
  (the descendant references are still useful as reference).
- The sidebar closes via backdrop click, the × button, or `Escape`.

## Files

- `src/lib/server/bo/recipenodesbo.ts` — substitute validation +
  apply path + `findDescendantSubstitutes` (recursive CTE on
  `parent_id`).
- `src/lib/obj/recipeDiff.ts` — substitute rendering in `formatNode`
  (same before→after diff as edit, but `SUB` badge).
- `src/lib/component/IngredientRow.svelte`,
  `src/lib/component/DirectionRow.svelte` — kebab menu Substitute item
  + per-row "Subs" chip.
- `src/lib/component/SubstitutesPanel.svelte` — slide-out sidebar
  listing descendant substitutes for the clicked row.
- `src/lib/component/Recipe.svelte` — wires `descendantSubstitutesByRowId`
  to row components + renders the sidebar.
- `src/lib/types/descendantSubstitute.ts` — client-safe re-export of
  the `DescendantSubstitute` type (the source lives in the server BO
  module; client imports it via `import type`).
- `src/routes/mise/api/recipe-node/[nodeId]/substitutes/+server.ts` —
  JSON endpoint for tooling / external callers.
- `src/routes/mise/recipes/[slug]/+page.server.ts` — exposes
  `data.descendantSubstitutes` for SSR.
- `scripts/seed.ts` — `Dairy-Free Omelette` (fork of Simple) carries
  substitute changes so the panel has data when viewing Simple Omelette.
- `tests/e2e/recipe-substitute.e2e.ts` — 12 e2e tests covering all three
  display sites, the kebab-menu wire, the per-row chip, the sidebar
  open + close paths (backdrop / × / Escape), and chip persistence
  after a same-row substitute.
