# Recipe editing

Editing happens on the **leaf** — the node currently being viewed.
Each visible row maps to either a leaf change record or an ancestor
change record. The split drives how each operation translates into a
JSONB change; see [ADR 0001](../adr/0001-per-node-in-place-edits.md) for
the full Case A / Case B rule.

## Mutations (per row)

- **Add** — new row with a fresh id; lives only on the leaf.
- **Edit** — Case A (leaf owns the row's add): mutate the record in
  place, same id and op, new body. Case B (inherited from ancestor):
  push a new edit record on the leaf targeting the ancestor's add id.
- **Remove** — Case A: drop the leaf's record. Case B: push a remove
  record on the leaf.
- **Move up / Move down** — implemented as remove + add. The new add
  lands at the end of the apply order, so the row jumps to the bottom
  (cosmetic limitation noted; out of scope to fix here).

## Add forms

"Add new ingredient" / "Add new direction" toggle inline forms with
name / amount / unit (ingredient) or body (direction) inputs. Submit
appends an add change to the leaf's working set.

## Notes

Each change record can carry a free-text note (nullable). Rows with a
note show a 📝 badge inline; the history section shows the same notes
for ancestor-owned changes. Notes are edited via a shared
`NoteSidebar` slide-out (Escape closes; Save / Delete / Cancel
buttons).

## Save

"Save" PUTs the leaf's full change arrays to
`/api/recipe-node/[nodeId]`. The button reads "Saving…" while pending
and re-enables on success. The server replaces the leaf row's JSONB
columns in place — no new node is created.

"Reset" discards unsaved local edits by re-syncing from `currentNode`.

## Files

- `src/lib/component/Recipe.svelte` — editor + handlers
- `src/lib/component/IngredientRow.svelte` / `DirectionRow.svelte`
- `src/lib/component/NodeChanges.svelte` — leaf-change summary
- `src/lib/component/NoteSidebar.svelte` — note editor
- `src/routes/api/recipe-node/[nodeId]/+server.ts` — save endpoint
