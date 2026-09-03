# AGENTS.md

## Project Explaination

This project is a recipe web app that allows users to iterate on recipes and allow a git like branching system.
Recipes exists as nodes in a Directional Acyclical Graph, hence, `recipe_node`.

Recipe nodes only have a parent relationship, if there is one. A root recipe node will have no parent id, but many recipe nodes can point to one recipe node.

Each recipe node has fields on it for ingredient changes and direction changes.
These changes are adding, removing, or editing an ingredient or direction.
Recipes are built from these recipe nodes and their changes.

For example, a simple omlette, being the root of a recipe tree, can have decendents such as denver omlette or french omlette.

If the root simple omlette is an omlette using butter, salt and cheese as ingredients, it would have three changes on the node being

- add "Egg 2"
- add "Butter 1 tbsp"
- add "salt 1 pinch"
- add "cheese 1/4 cup"

The denver omlette, being a child of the simple omlette doesn't need to reiterate all of its common ingredients. It would suffice for the denver omlette recipe node to have the changes

- add "Ham 1/4 cup"
- add "Pepper 1 tsp"
- add "Onion 1/4 cup"

Resulting in the following when the denver omlette recipe is built from the denver omlette recipe node, referencing its ancestor nodes.

- "Egg 2"
- "Butter 1 tbsp"
- "salt 1 pinch"
- "cheese 1/4 cup"
- "Ham 1/4 cup"
- "Pepper 1 tsp"
- "Onion 1/4 cup"

The french omellette recipe node, if it were the child of the denver omlette, for sake of example, would have the following changes.

- Edit "Butter 1 tbsp" -> "Butter 2 tbsp"
  remove "cheese 1/4 cup"
- remove "Ham 1/4 cup"
- remove "Pepper 1 tsp"
- remove "Onion 1/4 cup"
- add "Chives .5 tsp"

Each change has an id which is how edits and removals are targetted.

That is to say, editing a recipe node does not always result in a new recipe node. Editing a recipe node's data should either
a) edit the change itself, in the case of needing to adjust an ingedient thats already there i.e. Changing the denver omlette to use 3 eggs instead of 2.
b) Adding a new change,
c) Removing a change.

These will not recipe in a new recipe node.

### Save semantics (ADR 0001)

The save endpoint is `PUT /api/recipe-node/[nodeId]`. It replaces the leaf
node's `ingredient_changes` and `direction_changes` JSONB columns in place;
it does NOT create a new recipe node. See `docs/adr/0001-per-node-in-place-edits.md`.

Wire body:
```
{
  nodeId: string,
  ingredientChanges: IngredientChange[],
  directionChanges: DirectionChange[],
  label?: string | null
}
```

The client is authoritative for the leaf's change arrays — the server is a
dumb store. Apply happens only at read-time via `applyNodes`.

### Editing a row — Case A vs Case B

For each visible row, the leaf needs to decide whether it owns the row's
changes (Case A) or the row is inherited from an ancestor (Case B):

- **Case A — leaf owns a change referencing this row's add-id:**
  - Edit → mutate the change record in place (same `id`, same `op`, new `body`).
  - Remove → delete the change record from the leaf's array.
- **Case B — inherited from ancestor's add:**
  - Edit → push `{changeType:'edit', targetId: addId, body: newValue}` on the leaf.
  - Remove → push `{changeType:'remove', targetId: addId}` on the leaf.

`targetId` always refers to the originating add change's id (NOT a runtime
row id). The apply logic keys runtime rows by this same id, so they coincide.

### Forking (ADR 0002)

The verb "Fork" is retained on the UI for familiarity — it is a recipe
app, and "fork" is the term users expect on this surface. Under the
hood, fork = chain extension: a new node is appended to the chain
containing the leaf the user clicked fork on, with `parent_id = leafId`
and empty change arrays. See `docs/adr/0002-fork-as-chain-extension.md`.

Concretely:
- New node is in the same chain as the source (shares the recipe's
  root and identity).
- New node's materialized state is identical to the source's until
  the user adds their own changes to the new node.
- New node appears in the recipe list nested under the source leaf.

The schema has a single parent pointer (`parent_id`); the legacy
`parent_node_id` cross-recipe fork pointer was dropped in migration
`20260101000300_drop_parent_node_id.sql`.


### Important files

These are critical files for understanding core functionality
`src/lib/obj/RecipeNode.svelte.ts` the central datastructure for this project
`src/lib/server/bo/recipenodesbo.ts` the business logic for this project
