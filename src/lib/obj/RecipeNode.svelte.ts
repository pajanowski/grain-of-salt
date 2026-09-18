import type { Ingredient, Direction } from './Recipe.svelte';

export type ChangeType = 'add' | 'edit' | 'remove' | 'substitute';

/**
 * A single delta against an ingredient or direction.
 * - 'add':         the leaf owns the row's full body. `targetId` may be null
 *                  (row is brand new — leaf has never seen this id) OR a
 *                  string (row was inherited from an ancestor; the leaf
 *                  claims a position for it without overriding its body).
 *                  body holds the row's contents.
 * - 'edit':        targetId is the id of the row this edit is mutating
 *                  (same value as the originating add's body.id); body
 *                  holds the FULL new state.
 * - 'remove':      targetId is the id of the row to delete; body is null.
 * - 'substitute':  reserved for future use. Schema- and validation-ready;
 *                  the apply step has no case for it yet, so it is silently
 *                  skipped on replay. Wire shape and storage path are
 *                  identical to the other change types so adding behavior
 *                  later does not require a schema migration.
 *
 * Edits carry the full new value rather than a partial patch. Simpler,
 * idempotent, and trivially replayable.
 */
export interface Change<T> {
	// ID of change
	id: string;
	changeType: ChangeType;
	// For 'add' on a brand-new row: null. For 'add' repositioning an
	// ancestor-originated row: the row id (same as body.id). For 'edit'
	// / 'remove': the row id.
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
	/** Unix epoch milliseconds. */
	timestamp: Date;
	ingredientChanges: IngredientChange[];
	directionChanges: DirectionChange[];
	/** Author display name, set on first fork/edit. */
	author: string | null;
	/** Source hostname, set on import. */
	source: string | null;
	/** True when this node is reachable without authentication. */
	isPublic: boolean;
}
