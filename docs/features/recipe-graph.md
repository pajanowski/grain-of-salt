# Recipe Graph

Interactive directed-acyclic-graph (DAG) visualisation of a recipe node and its descendants.

## Behaviour

- **Route**: `/mise/recipes/[nodeId]/graph`
- **Link**: "View graph →" on the recipe page and at the bottom of the graph page
- **Graph**: SvelteFlow renders the whole tree the current node belongs to — every branch (ancestor siblings included) is shown, with the current node highlighted in blue
- **Layout**: dagre top-down layout with per-node heights estimated from each node's change count (so change-heavy cards don't overlap), and same-rank siblings staggered horizontally
- **Interaction**: Tap any node to navigate to its recipe page
- **Unauthenticated**: Shows a sign-in prompt instead of the graph

## Files

- `src/routes/mise/recipes/[slug]/graph/+page.server.ts` — loads the recipe tree and extracts the relevant subtree
- `src/routes/mise/recipes/[slug]/graph/+page.svelte` — page shell and navigation
- `src/lib/component/RecipeGraph.svelte` — SvelteFlow component; renders nodes from the tree returned by the server
- `src/lib/component/GraphInitializer.svelte` — builds the DAG (flat nodes + edges), estimates card heights and computes the staggered layout
