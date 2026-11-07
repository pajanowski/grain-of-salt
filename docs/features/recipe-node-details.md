# Recipe node details

Every recipe node carries two optional, node-level metadata fields — a
`description` (a short summary of the change the node makes) and a `note`
(freeform notes about the node itself). Both are display-only metadata: the
replay pass ignores them, writing them never bumps the node's `timestamp`,
and they ride along on every row (they are not changes).

## Behaviour

- Private page (`/mise/recipes/[slug]`): the description renders under the
  recipe title with a pencil edit button (Dialog form) for the owner; a note
  icon sits under the description and opens the notes popout. When the node
  has no note, owners see an "Add note" affordance instead. The popout is
  editable for the owner (textarea + Confirm / Delete / Cancel).
- Ownership: the page load returns `isOwner` (node `owner_id` vs signed-in
  user; always true in demo mode). Non-owners see both fields read-only —
  no edit affordances. The server re-enforces ownership on every write.
- Public page (`/recipe/[id]`): the description renders under the title; the
  note icon appears under the description only when a note exists and opens
  a read-only popout. The public page is always read-only.
- Saves go through `PATCH /mise/api/recipe-node/[nodeId]/details` (only the
  keys present in the body are written; empty strings normalize to `null`)
  or, in demo mode, `demoStore.updateNodeDetails`. Both surface in `$lib/api`
  as `updateNodeDetails`.
- The public route reads node metadata through the `get_recipe_chain` RPC,
  whose explicit `RETURNS TABLE` column list includes `description`/`note`
  (see migration `20261107000000_recipe_node_description_note.sql`).

## Files

- `src/lib/server/db/schema.ts` — `description` / `note` columns
- `supabase/migrations/20261107000000_recipe_node_description_note.sql`
- `src/lib/obj/RecipeNode.svelte.ts` — `RecipeNode` fields
- `src/lib/server/bo/recipenodesbo.ts` — `updateRecipeNodeDetails`,
  `getRecipeNodeOwnerId`, `toUiRecipeNode` mapping
- `src/routes/mise/api/recipe-node/[nodeId]/details/+server.ts` — PATCH route
- `src/lib/api.ts` — `updateNodeDetails` client helper
- `src/lib/recipe-store.ts`, `src/lib/recipe-store.demo.ts` — demo-mode write
- `src/lib/component/NodeNoteSheet.svelte` — read-only / editable popout
- `src/lib/component/Recipe.svelte` — private-page header display + editing
- `src/lib/component/PublicRecipe.svelte` — public-page display
