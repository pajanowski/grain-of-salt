# 0001 — Per-node in-place edits via PUT to recipe-node endpoint

**Status:** Accepted
**Date:** 2026-09-03

## Context

The save endpoint `PUT /api/save` accepts the full materialized `Recipe` (every inherited ingredient and direction) and the server (`updateRecipeState` in `src/lib/server/bo/recipenodesbo.ts:282-317`) unconditionally appends a new node to the chain on any non-empty diff. Two distinct operations are conflated:

- **In-place edit** — modifying an existing change on the editing node. Per `AGENTS.md` L50-55, this should mutate the existing change record, not create a new node.
- **Fork** — explicit branching. The only path that should create a new node.

Effects:
- `RecipeHistory.svelte` accumulates one chain node per save, including single-character edits like "Egg 2 → Egg 3".
- The wire carries the entire built recipe (with ancestor-inherited rows) for what should be a localized mutation.

## Decision

### Wire format

- New endpoint: `PUT /api/recipe-node/[nodeId]` body `{ nodeId, ingredientChanges, directionChanges, label? }`.
- Server is a dumb store on save: validates each `Change<T>` shape and replaces the JSONB columns on the row.
- Empty both arrays + unchanged label → no DB write.

### Edit semantics

- Editing node identity = page URL `slug` (the leaf), not the root.
- `targetId` = originating add change's id (not a runtime row id). This matches the existing `applyNodes` keying — see `recipenodesbo.ts` `applyIngredientChange` / `applyDirectionChange`.
- **Case A** — leaf owns a change referencing this row's add-id:
  - Edit → mutate the change record in place (same `id`, same `op`, new `body`).
  - Remove → delete the change record from the leaf's array.
- **Case B** — row exists only because of an ancestor's add:
  - Edit → push `{changeType:'edit', targetId: addId, body: newValue}` on the leaf.
  - Remove → push `{changeType:'remove', targetId: addId}` on the leaf.

### Other

- Reorder → remove + add.
- Recipe identity (root) is unchanged for rename / fork / delete.
- Last-write-wins on concurrent saves; no locking.
- `applyNodes` is unchanged — its runtime-row-keying already aligns with `targetId = add change id`.

### Out of scope

- `POST /api/recipe/[rootId]/fork` — forks, unchanged.
- `PATCH /api/recipe/[rootId]` — rename, unchanged.
- `DELETE /api/recipe/[rootId]` — delete, unchanged.

## Consequences

**Positive**
- History view shrinks: each entry reflects a real branch, not a single-character edit.
- Wire payload is small and localized — only the leaf's changes travel.
- Server no longer needs `diffIngredients` / `diffDirections` / `updateRecipeState`; apply is read-time only.
- Client becomes authoritative for the leaf's change array; replay-safe and idempotent.

**Negative / risks**
- Each save bumps `timestamp`. Page chain order is keyed by `parentId` (not timestamp), so history ordering is unaffected — verified by grep before implementation.
- Concurrent saves on the same leaf overwrite each other. Acceptable; documented as D6.
- The `Recipe` type (`src/lib/obj/Recipe.svelte.ts:40-45`) stops being the wire format. It remains the materialized runtime shape; the wire shape is `{ nodeId, ingredientChanges, directionChanges, label? }`. Distinct, but worth being clear in code.
- Two distinct ids on the page: `recipe.id` (root, for rename/fork/delete) and `currentNode.id` (leaf, for edit). Different endpoints make this explicit.

## Plan

### Phase 1 — Server

1. Add `updateRecipeNode(nodeId, ownerId, ingredientChanges, directionChanges, label?)` in `src/lib/server/bo/recipenodesbo.ts`. Owner check by `ownerId` direct lookup (every node in a chain shares it). Validate each change shape. UPDATE JSONB columns.
2. Add `src/routes/api/recipe-node/[nodeId]/+server.ts` exporting `PUT`. Reuse the `resolveOwnerId` pattern from `src/routes/api/save/+server.ts:15-22`.
3. Strip the `PUT` handler from `src/routes/api/save/+server.ts`. Keep `POST` and `DELETE`.
4. Delete `updateRecipeState`, `diffIngredients`, `diffDirections` from `recipenodesbo.ts` after grep confirms no callers.
5. Delete `updateRecipe` from `recipesbo.ts` after grep confirms no callers.

### Phase 2 — Page server

Update `src/routes/recipes/[slug]/+page.server.ts` to also return `currentNode: RecipeNode` (= `history[history.length - 1]`) so the client has the leaf's `ingredientChanges` / `directionChanges` for Case A vs Case B detection.

### Phase 3 — Client (`src/lib/component/Recipe.svelte`)

1. Stop mutating `recipeData.ingredients[i]` / `.directions[i]` directly. Track `leafIngredientChanges` / `leafDirectionChanges` as state, initialized from `data.currentNode`.
2. Compute ownership per visible row using `row.id` (= add change id) and the leaf's change arrays.
3. Map per-row handlers per the case rules above (same shape for ingredients and directions).
4. Save = `fetch('/api/recipe-node/${currentNode.id}', { method:'PUT', ... })` then `invalidateAll()`.

### Phase 4 — Tests

- `src/lib/server/bo/recipenodesbo.test.ts`: replace diff/append tests with cases covering Case A edit-in-place, Case A remove, Case B edit, Case B remove, reorder (remove+add), no-op skip, validation rejections, ownership rejection.
- `tests/e2e/recipe-edit.e2e.ts`, `recipe-actions.e2e.ts`, `debug-fork.e2e.ts`: target the new endpoint; verify history doesn't grow on edits; verify fork still appends.

### Phase 5 — Cleanup

- Tighten the `Change<T>` doc-comment in `src/lib/obj/RecipeNode.svelte.ts:14-24` to specify "targetId = id of the originating add change (NOT a runtime row id)."
- Update `AGENTS.md` to match the new model (wire format, no-node-on-edit, targetId semantics).

## Locked decisions (referenced above)

| # | Decision |
|---|---|
| D1 | Edit target = leaf (page URL `slug`) |
| D2 | Wire: `PUT /api/recipe-node/[nodeId]`, body `{ nodeId, ingredientChanges, directionChanges, label? }` |
| D3 | Change ids stable; client reuses them on in-place edits |
| D4 | No-op = empty arrays + unchanged label → skip DB write |
| D5 | Validate change shape server-side |
| D6 | Last-write-wins; no locking |
| D7 | Reorder = remove + add |
| D8 | Server is dumb store on save; apply is read-time only |
| D9 | `targetId` = originating add change's id |
| D10 | Recipe identity remains the root; rename/fork/delete unchanged |

## Status

Accepted. Implementation go-ahead pending.
