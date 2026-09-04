# Recipe management

The "Recipe actions" menu on each recipe page exposes two operations:
rename and delete.

## Rename

- Modal with a name input, pre-filled with the current name.
- `PATCH /api/recipe/[id]` updates the name on every node in the chain
  (so all breadcrumb links and history entries stay consistent).
- The recipe tree invalidates; the new name appears immediately.

## Delete

- `confirm(...)` prompt quoting the recipe name.
- `DELETE /api/recipe/[id]` deletes the root node; descendants come
  with it (via FK cascade).
- The user is redirected to `/`.

## Ownership

Both endpoints verify the caller owns the chain. Guests can manage
recipes on `DEMO_USER_ID`'s tree only.

## Files

- `src/lib/server/bo/recipesbo.ts` — `renameRecipe`, `deleteRecipe`
- `src/routes/api/recipe/[id]/+server.ts` — endpoints
- `src/lib/component/Recipe.svelte` — modal + handlers
