# Recipe creation

A "Create Recipe" button on the home page opens an inline form (name
input + Create / Cancel). Submitting POSTs to `/api/save`.

## Flow

- The form captures the recipe name only; ingredients and directions
  start empty.
- `POST /api/save` form-encodes `recipeName`. The server calls
  `saveNewRecipe` which creates a root node (`parent_id = null`) and
  returns the materialized recipe. The leaf is the root until the user
  edits.
- The home page invalidates its data and the new recipe appears as a
  top-level row in the tree.

## Ownership

- The new recipe belongs to the signed-in user. Unauthenticated
  requests are rejected with 401.

## Files

- `src/routes/+layout.svelte` — inline form + invalidate hook
- `src/routes/api/save/+server.ts` — endpoint
- `src/lib/server/bo/recipesbo.ts` — `saveNewRecipe`
- `src/lib/server/bo/recipenodesbo.ts` — `createRootRecipeNode`
