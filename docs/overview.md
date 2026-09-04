# Overview

Grain of Salt is a recipe web app where users iterate on recipes in a
git-like branching system. Recipes are nodes in a directional acyclic
graph (DAG), hence `recipe_node`.

## Data model

A recipe node has at most one `parent_id`. A root node has none; many
nodes can share a parent. Each node carries two JSONB change arrays —
`ingredient_changes` and `direction_changes` — recording adds, edits,
and removes. The full recipe is materialized by replaying the chain
root → ... → leaf at read time (`applyNodes`).

Editing a node does not always create a new node. Three options:

- Mutate an existing change in place (e.g. bump Simple's "Egg 2" to
  "Egg 3").
- Add a new change to the leaf.
- Remove a change.

Only **fork** creates a new node — see
[ADR 0002](adr/0002-fork-as-chain-extension.md). In-place edits are
governed by [ADR 0001](adr/0001-per-node-in-place-edits.md).

## Example: omelette tree

A simple omelette is the root; denver and french omelettes descend
from it. Each child only carries what differs from its ancestor.

**Simple Omelette (root):**

- add "Egg 2"
- add "Butter 1 tbsp"
- add "salt 1 pinch"
- add "cheese 1/4 cup"

**Denver Omelette (child of Simple):**

- add "Ham 1/4 cup"
- add "Pepper 1 tsp"
- add "Onion 1/4 cup"

Materialized at the Denver leaf:

- "Egg 2", "Butter 1 tbsp", "salt 1 pinch", "cheese 1/4 cup",
  "Ham 1/4 cup", "Pepper 1 tsp", "Onion 1/4 cup"

**French Omelette (child of Denver):**

- Edit "Butter 1 tbsp" → "Butter 2 tbsp"
- remove "cheese 1/4 cup"
- remove "Ham 1/4 cup"
- remove "Pepper 1 tsp"
- remove "Onion 1/4 cup"
- add "Chives .5 tsp"

## Key files

- `src/lib/obj/RecipeNode.svelte.ts` — central data structure
- `src/lib/server/bo/recipenodesbo.ts` — business logic
