# Recipe Favorites

A user can mark any recipe node they own as a **favorite** from the recipe
actions menu. A favorited recipe shows a small amber star next to its name
wherever the name is rendered, so the user can spot favorites at a glance.

## Behaviour

- **Per node, not per chain.** Each node in a recipe's chain has its own
  `is_favorite` flag. Forking a favorited recipe does not favorite the
  fork; deleting one node does not affect another's flag.
- **Toggle** from the recipe actions menu: one menu item whose label flips
  with state — **Favorite** when not favorited, **Unfavorite** when
  favorited. Owner-only.
- **Star indicator** next to the recipe name on the recipe detail header
  (`Recipe.svelte`). Rendered as a lucide `star` icon, amber-filled,
  `aria-label="Favorite"` so screen readers announce it. Only rendered
  when `isFavorite === true`; the header's `<h1>` keeps the same line
  height whether the star is present or not (the `<h1>` is a flex
  container with the star and the name inline).
- **API**: `PATCH /mise/api/recipe-node/[nodeId]/favorite` with no body.
  Returns `{ isFavorite: boolean }`. Owner-only via `assertNodeOwnership`.
- **Roadmap** (other surfaces to render the star): recipe tree sidebar
  (`RecipeList.svelte`), recipe history page (`RecipeHistory.svelte` +
  `RecipeNodeCard.svelte`), and the public recipe page
  (`PublicRecipe.svelte`). Each gets its own vertical slice.

## Data model

Add one boolean column to `recipe_nodes`:

```sql
-- new migration: supabase/migrations/<ts>_recipe_favorite.sql
alter table public.recipe_nodes
  add column is_favorite boolean not null default false;

create index recipe_nodes_favorite_idx
  on public.recipe_nodes (owner_id, is_favorite)
  where is_favorite = true;
```

Wire the column through:

- `src/lib/server/db/schema.ts` — add `isFavorite` to `recipeNodes`.
- `src/lib/obj/RecipeNode.svelte.ts` — add `isFavorite: boolean` to
  `RecipeNode` (default `false`).
- `src/lib/server/bo/recipenodesbo.ts` — surface `isFavorite` in
  `toUiRecipeNode`.

## UI

### `src/lib/component/Recipe.svelte`

Append to `menuItems`:

```ts
{
  label: currentNode.isFavorite ? 'Unfavorite' : 'Favorite',
  onSelect: () => toggleFavorite()
}
```

`toggleFavorite()` PATCHes `/mise/api/recipe-node/[nodeId]/favorite` and
calls `invalidateAll()` to refresh the materialized state.

In the recipe header `<h1>`, render `<StarIcon />` before the recipe
name when `data.currentNode.isFavorite`. The icon has
`data-testid="recipe-favorite-star"` for e2e selectors and
`aria-label="Favorite"` for assistive tech.

## API

### `PATCH /mise/api/recipe-node/[nodeId]/favorite` (new)

`src/routes/mise/api/recipe-node/[nodeId]/favorite/+server.ts`. Mirrors
the `/public` endpoint:

- Owner-only via `assertNodeOwnership`. 401 on no session, 403 on
  non-owner, 404 on missing node.
- Body: none. The flag flips on each PATCH (favorite → unfavorite and
  vice versa).
- Returns 200 + `{ isFavorite: boolean }`.

## Files

### Add

- `supabase/migrations/20260918000000_recipe_favorite.sql` — column +
  partial index
- `src/routes/mise/api/recipe-node/[nodeId]/favorite/+server.ts` —
  toggle endpoint
- `tests/e2e/recipe-favorite-toggle.e2e.ts` — owner can toggle from
  the actions menu, menu label flips
- `tests/e2e/recipe-favorite-star.e2e.ts` — star appears next to the
  recipe name when favorited, disappears when unfavorited

### Modify

- `src/lib/server/db/schema.ts` — `isFavorite` column on `recipeNodes`
- `src/lib/obj/RecipeNode.svelte.ts` — `isFavorite` on `RecipeNode`
- `src/lib/server/bo/recipenodesbo.ts` — `isFavorite` in `toUiRecipeNode`
- `src/lib/component/Recipe.svelte` — toggle menu item + star in header
- `docs/features/README.md` — register this feature

## Out of scope

- Stars on other surfaces (recipe tree, history, public page) — each
  gets its own vertical slice.
- Favorites across users — the flag is owner-scoped.
- A "Favorites" view / filter on the home page.
