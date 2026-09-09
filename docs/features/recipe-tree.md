# Recipe tree

The recipe tree is rendered as a nested list inside the authenticated
sidebar (see `/mise`). Built server-side by `getRecipeTree(ownerId)`
and consumed by `RecipeList.svelte`.

## Layout

- One row per visible node. Children indent under their parent.
- A `↳` glyph marks non-root rows.
- A row with collapsed children shows the count of hidden descendants.
- "Expand all" / "Collapse all" controls appear when there is at least
  one expandable subtree.

## Mobile layout

On viewports narrower than `md` (768px) the tree lives inside the
`mise/+layout.svelte` sidebar, which renders as a full-screen slide-in
overlay instead of a push-pane. Behaviour:

- The sidebar starts closed so direct recipe links land on the recipe.
- The bottom-of-screen floating buttons toggle it open (`≡`) or close
  (`×`) and focus the search input.
- Selecting a recipe, the profile link, or sign-in auto-closes the
  sidebar (via `afterNavigate`) so the destination is immediately
  visible.
- The tree stays mounted while hidden so search query and expanded
  nodes persist across toggles.

On viewports `md` and wider the sidebar is in flow: full (256px) by
default, collapsible to a 48px icon strip via the header button.

## Visibility

- Signed-in user → their own recipes.
- Unauthenticated → empty list ("No recipes yet").

## Inline create

A "Create Recipe" button below the tree opens an inline form. See
[recipe creation](./recipe-creation.md).

## Files

- `src/lib/component/RecipeList.svelte` — render + collapse state
- `src/routes/mise/+layout.svelte` — hosts the tree in its sidebar
- `src/routes/mise/+layout.server.ts` — fetches the tree
- `src/lib/server/bo/recipenodesbo.ts` — `getRecipeTree`