# Recipe Graph

Interactive directed-acyclic-graph (DAG) visualisation of a recipe node and its descendants.

## Behaviour

- **Route**: `/mise/recipes/[nodeId]/graph`
- **Link**: "View graph →" on the recipe page and at the bottom of the graph page
- **Graph**: SvelteFlow renders the whole tree the current node belongs to — every branch (ancestor siblings included) is shown, with the current node highlighted in blue
- **Layout**: dagre top-down layout with per-node heights measured after rendering (initial placeholder uses estimates from change counts); same-rank siblings staggered horizontally. Vertical positions are post-processed (`resolveTops`) so every child's top edge is strictly below its parent's bottom edge — a tall card can never overlap its children. The two‑phase measurement ensures the invariant holds against actual rendered card heights.
- **Interaction**: Tap any node to navigate to its recipe page
- **Unauthenticated**: Shows a sign-in prompt instead of the graph

## Files

- `src/routes/mise/recipes/[slug]/graph/+page.server.ts` — loads the recipe tree and extracts the relevant subtree
- `src/routes/mise/recipes/[slug]/graph/+page.svelte` — page shell and navigation
- `src/lib/component/RecipeGraph.svelte` — SvelteFlow component; renders nodes from the tree returned by the server
- `src/lib/component/GraphInitializer.svelte` — builds the DAG (flat nodes + edges), estimates card heights and computes the staggered layout
