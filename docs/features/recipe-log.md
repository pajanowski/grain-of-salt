# Recipe Log

Git-style commit log (magit-like) for a recipe tree, rendered as a plain
HTML list with an SVG rail — no graph library.

## Behaviour

- **Route**: `/mise/recipes/[nodeId]/log`
- **Link**: "Log" tab in the recipe sub-nav (alongside Recipe / Graph)
- **Data**: the whole tree the node belongs to (same load as the graph view)
- **Rows**: newest first (like `git log`); each row shows name, author,
  relative time, a change summary, and a short id. Clicking a row navigates
  to that node's recipe page.
- **Rail**: a git-log `--graph`-style lane rail drawn in an SVG overlay:
  - Rows are sorted newest first, so a child is drawn before its parent; a
    child reserves its lane for its parent.
  - The parent takes the first child's lane as a straight continuation;
    later siblings get fresh lanes that curve-merge into the parent's lane
    at the parent's row.
  - Straight verticals when a child's lane matches its parent's; a bezier
    curve otherwise. Lanes cycle through a small colour palette.
  - The current node is highlighted with a larger dot and a subtle amber
    row background.

## Files

- `src/lib/obj/logLayout.ts` — pure lane-assignment + edge computation
  (rows sorted newest first, lane reservation, edges)
- `src/lib/obj/logLayout.test.ts` — unit tests for the lane assignment
- `src/lib/component/RecipeLog.svelte` — SVG rail + row list rendering
- `src/routes/mise/recipes/[slug]/log/+page.server.ts` — loads the whole
  tree via the shared `loadWholeTree` helper
- `src/routes/mise/recipes/[slug]/log/+page.svelte` — page shell
- `src/lib/server/bo/graph-view.ts` — shared whole-tree loader used by both
  the graph and log pages
