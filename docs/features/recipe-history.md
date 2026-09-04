# Recipe history

Each recipe page shows the full chain of nodes (root → … → leaf) with
each node's changes listed below it. Collapsed by default.

## Layout

- One card per node, oldest at the top.
- Each change renders with a color: green (add), amber (edit), red
  (remove), followed by the changed text (e.g. `egg 2`,
  `butter 2 tbsp`).
- Changes that carry a note show a 📝 badge; clicking opens the
  `NoteSidebar` in read-only mode (no edit / delete controls).

## What's not here

The "Changes on this node" section under the editor is a separate
component (`NodeChanges.svelte`) that surfaces the leaf's working set
only. Use history to inspect ancestor-owned changes.

## Files

- `src/lib/component/RecipeHistory.svelte` — chain renderer
- `src/lib/obj/recipeDiff.ts` — `formatChain`, `nodeDisplayLabel`,
  `formatTimestamp`
- `src/lib/obj/RecipeNode.svelte.ts` — node shape
