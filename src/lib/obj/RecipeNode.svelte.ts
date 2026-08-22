import type { Ingredient, Direction } from "./Recipe.svelte";

export type ChangeType = 'add' | 'edit' | 'remove';

/**
 * A single delta against an ingredient or direction.
 * - 'add':    targetId is null; body describes the NEW row.
 * - 'edit':   targetId is the id of the existing row being mutated; body holds the FULL new state.
 * - 'remove': targetId is the id of the row being removed; body is ignored (null).
 *
 * Edits carry the full new value rather than a partial patch. Simpler, idempotent,
 * and trivially replayable.
 */
export interface Change<T> {
  // ID of change
  id: string;
  changeType: ChangeType;
  // ID of Ingredient or Direction that will be edited or removed, null for add
  targetId: string | null;
  // Note about change, most likely will be used to explain the reasoning
  note: string | null;
  // The full Ingredient or Direction contents for add/edit; null for remove.
  body: T | null;
}

export type IngredientChange = Change<Ingredient>;
export type DirectionChange = Change<Direction>;

export interface RecipeNode {
  /** Own id. Doubles as the recipe's identity on root nodes. */
  id: string;
  /** Recipe name. Denormalized so any node knows which recipe it belongs to. */
  name: string;
  /** Parent node id within the same recipe. null only on the root node. */
  parentId: string | null;
  /**
   * Hierarchy pointer. On a recipe root, points to a node in the parent
   * recipe's chain — making this recipe a "child" of that one. Null on
   * non-root nodes and on top-level recipe roots.
   */
  parentNodeId: string | null;
  /** Optional human-readable label ("added garlic", "doubled the salt"). */
  label: string | null;
  /** Unix epoch milliseconds. */
  timestamp: Date;
  ingredientChanges: IngredientChange[];
  directionChanges: DirectionChange[];
}
