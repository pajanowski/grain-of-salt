import type { Ingredient, Direction } from "./Recipe.svelte";

export type ChangeType = 'add' | 'edit' | 'remove';

/**
 * A single delta against an ingredient or direction.
 * - 'add':    targetId is null; body describes the NEW row.
 * - 'edit':   targetId is the id of the originating add change whose row
 *             this edit is mutating; body holds the FULL new state.
 * - 'remove': targetId is the id of the originating add change whose row
 *             this remove is deleting; body is null.
 *
 * `targetId` is the originating add change's id (not the runtime row id).
 * Under the apply logic these are the same value, but semantically a change
 * targets the add that produced the row — so descendant edits/removes can
 * reference ancestor adds unambiguously. See ADR 0001.
 *
 * Edits carry the full new value rather than a partial patch. Simpler,
 * idempotent, and trivially replayable.
 */
export interface Change<T> {
  // ID of change
  id: string;
  changeType: ChangeType;
  // ID of the originating add change (NOT a runtime row id). Null for 'add'.
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
  /** Optional human-readable label ("added garlic", "doubled the salt"). */
  label: string | null;
  /** Unix epoch milliseconds. */
  timestamp: Date;
  ingredientChanges: IngredientChange[];
  directionChanges: DirectionChange[];
}
