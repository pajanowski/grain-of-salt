# Forking

The verb "Fork" is retained on the UI for familiarity — it is a recipe
app, and "fork" is the term users expect. Under the hood it is **chain
extension**, not a separate recipe. See
[ADR 0002](../adr/0002-fork-as-chain-extension.md).

## Flow

- "Fork recipe" opens a modal pre-filled with `{recipe.name} (fork)`.
- `POST /api/recipe/[id]/fork` appends a new node with
  `parent_id = [id]` and empty change arrays. The new node inherits
  its parent's `owner_id`.
- The new node's materialized state is identical to the source's
  until the user adds their own changes.
- The client navigates to `/recipes/{newNodeId}` and the tree refreshes.

## Ownership

The caller must own the source chain. Guests can fork only within
`DEMO_USER_ID`'s tree.

## Files

- `src/lib/server/bo/recipesbo.ts` — `forkRecipe`
- `src/routes/api/recipe/[id]/fork/+server.ts` — endpoint
- `src/lib/component/Recipe.svelte` — modal + handler
