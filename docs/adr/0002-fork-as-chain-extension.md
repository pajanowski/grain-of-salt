# 0002 — Fork = chain extension (drop `parentNodeId`)

**Status:** Accepted
**Date:** 2026-09-03

## Context

The codebase had two competing concepts of "fork" sitting on top of each other:

- **Chain extension (a git branch):** a new node appended to an existing chain via `parentId`. Identical to the source's materialized state until the new node adds its own changes.
- **Cross-recipe fork (a separate recipe):** a new root with `parentNodeId` pointing into another recipe's chain. The new chain is independent — `applyNodes` doesn't replay the source — so a freshly created fork starts empty.

The schema carried both:

```sql
parent_id      uuid references recipe_nodes(id),  -- chain
parent_node_id uuid references recipe_nodes(id),  -- cross-recipe fork pointer
```

…with a `parent_node_only_on_root` check enforcing they were mutually exclusive.

The UI verb was "Fork recipe," but the implementation used the second concept: the new node had `parentNodeId = rootNodeId` (the URL parameter), was created via `createRootRecipeNode`, and was rendered as a top-level entry in the recipe list. Three symptoms followed:

1. The new recipe appeared at the top level of the recipe list — not under the leaf the user clicked fork on.
2. The new recipe had empty changes and so produced no materialized state.
3. Users reported the fork "filed as a root recipe" with "no resulting recipe."

## Decision

### Wire-level

- The fork endpoint (`POST /api/recipe/[id]/fork`) and the `forkRecipe` BO append a new node to the chain containing `[id]`, using `appendRecipeNode(parentId = leafId, name, [], [])`.
- The new node has `parentId = sourceLeafId` (chain extension), empty `ingredientChanges` / `directionChanges`, and inherits the parent's `ownerId` and `timestamp`.
- The new node's materialized state is identical to the source's until the user adds changes to it — matching `AGENTS.md` L57.

### Schema

`parentNodeId` is dropped, along with its associated check constraint and index. Migration `20260101000300_drop_parent_node_id.sql` performs:

- `drop constraint parent_node_only_on_root` — meaningless once one field is gone.
- `drop index recipe_nodes_parent_node_idx` — index on the dropped column.
- `drop column parent_node_id` — the column itself.

Drizzle schema and `RecipeNode` type lose the field. The `toUiRecipeNode` mapper drops its read. `createRootRecipeNode` and `saveNewRecipe` drop their third parameter. `appendRecipeNode` no longer sets `parentNodeId: null` in its insert.

### Naming

The UI verb stays **"Fork"** — the existing noun on a recipe app is familiar even though the underlying semantics is closer to a git branch. This is intentional and called out in the ADR so future contributors don't "fix" the verb to "Branch."

## Consequences

**Positive**

- One parent pointer instead of two. Schema is simpler; one index and one constraint gone.
- The model matches `AGENTS.md` L57 exactly: "Until changes are added to the new recipe node, the resulting recipe from the new recipe node will be identical to the resulting recipe of the existing node."
- Fork UI behavior is now: click fork on Denver → new node in Denver's chain → new chain entry nested under Denver in the tree → state matches Denver until edited.
- No more confusion about whether `parentNodeId` was supposed to be set or null.

**Negative / risks**

- **Tree shows N entries per lineage.** Each fork/branch is a new tree entry, even if it carries the same name as its parent. The recipe list grows per branch click. Pre-existing behavior — not new — but now reachable via UI.
- **Cross-recipe forks are gone.** If we ever want "fork as a separate recipe," that needs a different mechanism (and re-introducing the cross-recipe concept).
- **Data loss on migration.** Any existing rows with non-null `parentNodeId` lose that pointer when the column is dropped. In practice this is null everywhere, so no data is lost. The migration uses `if exists` to be safe on re-run.

## Locked decisions

| # | Decision |
|---|---|
| D1 | Fork = chain extension via `appendRecipeNode(parentId = leafId, ...)` |
| D2 | UI verb stays "Fork" (deliberately; see ADR body) |
| D3 | Drop `parentNodeId` column, the `parent_node_only_on_root` check, and the `recipe_nodes_parent_node_idx` index |
| D4 | Migration is forward-only — applied via `supabase migration up` or `pnpm db:reset` |

## Status

Accepted. Schema migration required to land.
