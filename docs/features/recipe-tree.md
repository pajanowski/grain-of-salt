# Recipe tree

The home page (`/`) renders the user's recipes as a nested tree, with
parents above children. Built server-side by `getRecipeTree(ownerId)`
and consumed by `RecipeList.svelte`.

## Layout

- One row per visible node. Children indent under their parent.
- A `↳` glyph marks non-root rows.
- A row with collapsed children shows the count of hidden descendants.
- "Expand all" / "Collapse all" controls appear when there is at least
  one expandable subtree.

## Visibility

- Signed-in user → their own recipes.
- Guest → the shared `DEMO_USER_ID` tree.
- Unauthenticated, no guest cookie → empty list ("No recipes yet").

## Inline create

A "Create Recipe" button below the tree opens an inline form. See
[recipe creation](./recipe-creation.md).

## Files

- `src/lib/component/RecipeList.svelte` — render + collapse state
- `src/routes/+layout.svelte` — hosts the tree and create form
- `src/routes/+layout.server.ts` — fetches the tree
- `src/lib/server/bo/recipenodesbo.ts` — `getRecipeTree`
