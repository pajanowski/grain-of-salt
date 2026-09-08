# Recipe Graph

Interactive directed-acyclic-graph (DAG) visualisation of a recipe node and its descendants.

## Behaviour

- **Route**: `/mise/recipes/[nodeId]/graph`
- **Link**: "View graph →" on the recipe page and at the bottom of the graph page
- **Graph**: Cytoscape.js renders the subtree rooted at the current node — current node is highlighted in blue, ancestors/descendants in stone
- **Interaction**: Tap any node to navigate to its recipe page
- **Unauthenticated**: Shows a sign-in prompt instead of the graph

## Files

- `src/routes/mise/recipes/[slug]/graph/+page.server.ts` — loads the recipe tree and extracts the relevant subtree
- `src/routes/mise/recipes/[slug]/graph/+page.svelte` — page shell and navigation
- `src/lib/component/RecipeGraph.svelte` — Cytoscape.js component; tree built client-side from the subtree returned by the server
