# Recipe view

`/recipes/[slug]` renders the materialized recipe at any node in the
chain. `slug` is any recipe node id — root or descendant.

## Materialization

The server walks `parent_id` from the slug back to the root, reverses
to root → … → slug, and replays every node via `applyNodes`. The result
is the full ingredient + direction list as the leaf sees it.

## Header

- Recipe name + a "Recipe actions" menu (see [recipe
  management](./recipe-management.md) and [forking](./forking.md)).

## Breadcrumbs

For non-root slugs, ancestors between the root and the current node
appear above the editor. The root and the current node are omitted
(the root is the page itself; the current is "here"). Clicking a
breadcrumb navigates to that node's view of the same recipe.

## Editing surface

The editor + per-row notes + save controls live on the recipe page —
see [recipe editing](./recipe-editing.md). The history of every node
in the chain lives at the bottom — see [recipe
history](./recipe-history.md).

## Files

- `src/routes/recipes/[slug]/+page.svelte` — page composition
- `src/routes/recipes/[slug]/+page.server.ts` — chain walk + apply
- `src/lib/server/bo/recipenodesbo.ts` — `getRecipeNodesByRecipeIdV2`,
  `applyNodes`
