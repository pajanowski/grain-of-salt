/**
 * RecipeStore interface (ADR 0003 — Store interface).
 *
 * Two implementations — Supabase-backed (production) and demo
 * (in-memory + localStorage) — sit behind this single shape. The
 * dispatch functions in src/lib/recipes.ts route to the right
 * adapter; components never see which one is in play.
 *
 * The contract pins what the components rely on:
 *   - `list()` returns every recipe summary, root and child, with
 *     `parentId` set for non-root recipes.
 *   - `get(id)` returns the materialized tree for the given root node
 *     id, or null when not found.
 *   - `create(name)` creates a new root recipe with one node and
 *     returns its (newly minted) root id.
 *   - `rename(id, name)` updates the recipe name. Silently no-ops on
 *     an unknown id (callers fire-and-forget).
 *   - `fork(nodeId)` appends a new node to the chain containing
 *     `nodeId` (per ADR 0002 — fork = chain extension). Returns the
 *     id of the new node. Throws on an unknown nodeId — the caller
 *     should not silently create a phantom recipe.
 *   - `remove(id)` deletes the recipe and its chain.
 *   - `saveNode(nodeId, changes)` replaces the leaf node's change
 *     arrays in place (ADR 0001 — per-node in-place edits).
 */
import type { RecipeNode, IngredientChange, DirectionChange } from './obj/RecipeNode.svelte';

/**
 * Lightweight summary used by the recipe tree UI. Each recipe's
 * identity is the root node's id; for chained recipes the leaf node
 * id is what `fork` returns (and what `/recipes/[slug]` resolves).
 */
export interface RecipeSummary {
	id: string;
	name: string;
	/** Null for top-level (root) recipes; the parent node id otherwise. */
	parentId: string | null;
}

export interface RecipeTree {
	summary: RecipeSummary;
	/** Ordered root → ... → leaf list of nodes that make up this recipe. */
	nodes: RecipeNode[];
}

export interface NodeChanges {
	nodeId: string;
	ingredientChanges: IngredientChange[];
	directionChanges: DirectionChange[];
}

export interface RecipeStore {
	list(): Promise<RecipeSummary[]>;
	get(id: string): Promise<RecipeTree | null>;
	create(name: string): Promise<{ id: string }>;
	rename(id: string, name: string): Promise<void>;
	fork(nodeId: string, name?: string): Promise<{ id: string }>;
	remove(id: string): Promise<void>;
	saveNode(nodeId: string, changes: NodeChanges): Promise<void>;
}
