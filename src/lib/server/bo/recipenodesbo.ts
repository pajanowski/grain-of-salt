import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index';
import { recipeNodes } from '../db/schema';
import type { InsertRecipeNode, SelectRecipeNode } from '../db/schema';
import type { Ingredient, Direction } from '$lib/obj/Recipe.svelte';
import type { RecipeNode, IngredientChange, DirectionChange } from '$lib/obj/RecipeNode.svelte';

/**
 * Materialized state derived by replaying every node in a recipe's history,
 * oldest first.
 */
export interface RecipeState {
	ingredients: Ingredient[];
	directions: Direction[];
}

/**
 * Create a root node for a brand-new recipe owned by `ownerId`.
 * The root node has parentId = null.
 */
export async function createRootRecipeNode(
	name: string,
	ownerId: string,
): Promise<RecipeNode> {
	const row: InsertRecipeNode = {
		parentId: null,
		ownerId,
		name,
		label: null,
		ingredientChanges: [],
		directionChanges: [],
	};
	const [inserted] = await db.insert(recipeNodes).values(row).returning();
	return toUiRecipeNode(inserted);
}


/**
 * Append a child node to an existing parent. parentId is required — to create
 * the first node of a recipe, use createRootRecipeNode.
 *
 * Ownership is propagated from the chain: the new node inherits its parent's
 * ownerId, so a forked recipe stays owned by the original user. (Forks
 * therefore also live under the same RLS scope as the source.)
 */
export async function appendRecipeNode(
	parentId: string,
	name: string,
	ingredientChanges: IngredientChange[],
	directionChanges: DirectionChange[],
	label: string | null = null,
): Promise<RecipeNode> {
	// Look up the parent to inherit ownerId.
	const parentRows = await db
		.select({ ownerId: recipeNodes.ownerId })
		.from(recipeNodes)
		.where(eq(recipeNodes.id, parentId))
		.limit(1);
	const ownerId = parentRows[0]?.ownerId;
	if (!ownerId) {
		throw new Error(`Parent node ${parentId} not found`);
	}

	const row: InsertRecipeNode = {
		parentId,
		ownerId,
		name,
		label,
		ingredientChanges,
		directionChanges,
	};
	const [inserted] = await db.insert(recipeNodes).values(row).returning();
	return toUiRecipeNode(inserted);
}


/**
 * Fetch every node in the chain rooted by rootNodeId, oldest first.
 *
 * The chain is a linked list via `parentId`: each non-root node's parentId
 * points to its predecessor. We walk forward from the root until we hit a
 * leaf — bounded by history depth, so the per-chain query count is
 * proportional to chain length.
 *
 * Authorization: the caller is responsible for having confirmed the user
 * owns the root (or that the chain belongs to DEMO_USER_ID for guests).
 */
export async function getRecipeNodesByRecipeId(rootNodeId: string): Promise<RecipeNode[]> {
	const nodes: RecipeNode[] = [];
	let cursor: string | null = rootNodeId;
	const visited = new Set<string>();
	while (cursor !== null) {
		if (visited.has(cursor)) break; // cycle guard
		visited.add(cursor);
		const rows = await db
			.select()
			.from(recipeNodes)
			.where(eq(recipeNodes.id, cursor))
			.limit(1);
		const row = rows[0];
		if (!row) break;
		nodes.push(toUiRecipeNode(row));
		const next = await db
			.select({ id: recipeNodes.id })
			.from(recipeNodes)
			.where(eq(recipeNodes.parentId, cursor))
			.orderBy(asc(recipeNodes.timestamp))
			.limit(1);
		cursor = next[0]?.id ?? null;
	}
	return nodes;
}

export async function getRecipeNodesByRecipeIdV2(recipeNodeId: string): Promise<RecipeNode[]> {
	const nodes: RecipeNode[] = [];
	let curId: string | null = recipeNodeId;
	while (curId != null) {
		const rows: SelectRecipeNode[] = await db
			.select()
			.from(recipeNodes)
			.where(eq(recipeNodes.id, curId))
			.limit(1);
		const recipeNode = rows[0];
		curId = recipeNode?.parentId ?? null;
		if (recipeNode) {
			nodes.push(toUiRecipeNode(recipeNode));
		}
	}

	return nodes;
}
/**
 * Alias of getRecipeNodesByRecipeId for readability at call sites that
 * are building a history UI.
 */
export const getRecipeHistory = getRecipeNodesByRecipeId;

/**
 * Resolve any node id in a chain to the chain's root (the node whose
 * parentId is null). Returns null if no node with that id exists.
 */
export async function getRootRecipeNode(nodeId: string): Promise<RecipeNode | null> {
	let cursorId: string | null = nodeId;
	const visited = new Set<string>();
	let cursor: RecipeNode | null = null;
	while (cursorId !== null) {
		if (visited.has(cursorId)) break;
		visited.add(cursorId);
		const rows: SelectRecipeNode[] = await db
			.select()
			.from(recipeNodes)
			.where(eq(recipeNodes.id, cursorId))
			.limit(1);
		const row = rows[0];
		if (!row) return null;
		cursor = toUiRecipeNode(row);
		cursorId = row.parentId;
	}
	return cursor;
}

/**
 * Ordering rules:
 *  - Nodes are applied in ascending timestamp order (oldest first).
 *  - Within a node, ingredientChanges are applied in array order, then
 *    directionChanges in array order. Callers are responsible for ordering
 *    their changes such that a 'remove' of an id precedes any later
 *    'edit'/'add' that would conflict with it.
 *
 * 'add' inserts a new row, 'edit' replaces the row by targetId, 'remove'
 * deletes the row by targetId.
 */
export async function getRecipeState(rootNodeId: string): Promise<RecipeState> {
	const nodes = await getRecipeNodesByRecipeId(rootNodeId);
	return applyNodes(nodes);
}

/**
 * Pure function: replay an ordered list of nodes against an empty state.
 * Exported for testing and for callers who already have the nodes in hand.
 */
export function applyNodes(nodes: RecipeNode[]): RecipeState {
	const ingredients = new Map<string, Ingredient>();
	const directions = new Map<string, Direction>();

	for (const node of nodes) {
		for (const change of node.ingredientChanges) {
			applyIngredientChange(ingredients, change);
		}
		for (const change of node.directionChanges) {
			applyDirectionChange(directions, change);
		}
	}

	return {
		ingredients: Array.from(ingredients.values()),
		directions: Array.from(directions.values()),
	};
}

function applyIngredientChange(
	state: Map<string, Ingredient>,
	change: IngredientChange,
): void {
	switch (change.changeType) {
		case 'add': {
			if (!change.body) return; // malformed: add requires a body
			const id = change.body.id || change.id;
			state.set(id, { ...change.body, id });
			return;
		}
		case 'edit': {
			if (!change.targetId || !change.body) return; // malformed
			if (state.has(change.targetId)) {
				state.set(change.targetId, { ...change.body, id: change.targetId });
			}
			return;
		}
		case 'remove': {
			if (change.targetId) state.delete(change.targetId);
			return;
		}
	}
}

function applyDirectionChange(
	state: Map<string, Direction>,
	change: DirectionChange,
): void {
	switch (change.changeType) {
		case 'add': {
			if (!change.body) return;
			const id = change.body.id || change.id;
			state.set(id, { ...change.body, id });
			return;
		}
		case 'edit': {
			if (!change.targetId || !change.body) return;
			if (state.has(change.targetId)) {
				state.set(change.targetId, { ...change.body, id: change.targetId });
			}
			return;
		}
		case 'remove': {
			if (change.targetId) state.delete(change.targetId);
			return;
		}
	}
}

function toUiRecipeNode(row: SelectRecipeNode): RecipeNode {
	return {
		id: row.id,
		name: row.name,
		parentId: row.parentId,
		label: row.label,
		timestamp: row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp),
		ingredientChanges: (row.ingredientChanges ?? []) as IngredientChange[],
		directionChanges: (row.directionChanges ?? []) as DirectionChange[],
	};
}



/**
 * Wire payload for `PUT /api/recipe-node/[nodeId]`. The client sends the leaf
 * node's full change arrays; the server replaces them on the row. The shape
 * is intentionally symmetric — ingredients and directions are independent
 * for ordering, but flow through the same path.
 */
export interface UpdateRecipeNodePayload {
	nodeId: string;
	ingredientChanges: IngredientChange[];
	directionChanges: DirectionChange[];
	label?: string | null;
}

/**
 * Thrown when a change record fails validation. Surfaced as a 400 by the
 * route handler.
 */
export class InvalidChangeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidChangeError';
	}
}

function validateIngredientChange(c: unknown, index: number): asserts c is IngredientChange {
	if (!c || typeof c !== 'object') {
		throw new InvalidChangeError(`ingredientChanges[${index}] must be an object`);
	}
	const obj = c as Record<string, unknown>;
	if (typeof obj.id !== 'string' || obj.id.length === 0) {
		throw new InvalidChangeError(`ingredientChanges[${index}].id must be a non-empty string`);
	}
	const op = obj.changeType;
	if (op !== 'add' && op !== 'edit' && op !== 'remove') {
		throw new InvalidChangeError(`ingredientChanges[${index}].changeType must be 'add' | 'edit' | 'remove'`);
	}
	if (op === 'add') {
		if (obj.targetId !== null) {
			throw new InvalidChangeError(`ingredientChanges[${index}] (add) must have targetId === null`);
		}
		if (!obj.body || typeof obj.body !== 'object') {
			throw new InvalidChangeError(`ingredientChanges[${index}] (add) must have a body`);
		}
	} else if (op === 'edit') {
		if (typeof obj.targetId !== 'string' || obj.targetId.length === 0) {
			throw new InvalidChangeError(`ingredientChanges[${index}] (edit) must have a targetId`);
		}
		if (!obj.body || typeof obj.body !== 'object') {
			throw new InvalidChangeError(`ingredientChanges[${index}] (edit) must have a body`);
		}
	} else {
		// remove
		if (typeof obj.targetId !== 'string' || obj.targetId.length === 0) {
			throw new InvalidChangeError(`ingredientChanges[${index}] (remove) must have a targetId`);
		}
		if (obj.body !== null) {
			throw new InvalidChangeError(`ingredientChanges[${index}] (remove) must have body === null`);
		}
	}
}

function validateDirectionChange(c: unknown, index: number): asserts c is DirectionChange {
	if (!c || typeof c !== 'object') {
		throw new InvalidChangeError(`directionChanges[${index}] must be an object`);
	}
	const obj = c as Record<string, unknown>;
	if (typeof obj.id !== 'string' || obj.id.length === 0) {
		throw new InvalidChangeError(`directionChanges[${index}].id must be a non-empty string`);
	}
	const op = obj.changeType;
	if (op !== 'add' && op !== 'edit' && op !== 'remove') {
		throw new InvalidChangeError(`directionChanges[${index}].changeType must be 'add' | 'edit' | 'remove'`);
	}
	if (op === 'add') {
		if (obj.targetId !== null) {
			throw new InvalidChangeError(`directionChanges[${index}] (add) must have targetId === null`);
		}
		if (!obj.body || typeof obj.body !== 'object') {
			throw new InvalidChangeError(`directionChanges[${index}] (add) must have a body`);
		}
	} else if (op === 'edit') {
		if (typeof obj.targetId !== 'string' || obj.targetId.length === 0) {
			throw new InvalidChangeError(`directionChanges[${index}] (edit) must have a targetId`);
		}
		if (!obj.body || typeof obj.body !== 'object') {
			throw new InvalidChangeError(`directionChanges[${index}] (edit) must have a body`);
		}
	} else {
		// remove
		if (typeof obj.targetId !== 'string' || obj.targetId.length === 0) {
			throw new InvalidChangeError(`directionChanges[${index}] (remove) must have a targetId`);
		}
		if (obj.body !== null) {
			throw new InvalidChangeError(`directionChanges[${index}] (remove) must have body === null`);
		}
	}
}

function validatePayload(payload: UpdateRecipeNodePayload): void {
	if (!payload || typeof payload !== 'object') {
		throw new InvalidChangeError('payload must be an object');
	}
	if (typeof payload.nodeId !== 'string' || payload.nodeId.length === 0) {
		throw new InvalidChangeError('nodeId must be a non-empty string');
	}
	if (!Array.isArray(payload.ingredientChanges)) {
		throw new InvalidChangeError('ingredientChanges must be an array');
	}
	if (!Array.isArray(payload.directionChanges)) {
		throw new InvalidChangeError('directionChanges must be an array');
	}
	payload.ingredientChanges.forEach((c, i) => validateIngredientChange(c, i));
	payload.directionChanges.forEach((c, i) => validateDirectionChange(c, i));
	if (payload.label !== undefined && payload.label !== null && typeof payload.label !== 'string') {
		throw new InvalidChangeError('label must be a string or null');
	}
}

/**
 * Verify that the given node exists and belongs to `ownerId`. Every node in a
 * chain shares the same ownerId (set at root creation), so a direct lookup
 * is sufficient — no walk up the chain.
 *
 * Throws 'Node not found' if the row is absent and 'Forbidden' on owner
 * mismatch. The route handler maps these to 404 and 403 respectively.
 */
async function assertNodeOwnership(nodeId: string, ownerId: string): Promise<void> {
	const rows = await db
		.select({ ownerId: recipeNodes.ownerId })
		.from(recipeNodes)
		.where(eq(recipeNodes.id, nodeId))
		.limit(1);
	if (rows.length === 0) {
		throw new Error('Node not found');
	}
	if (rows[0].ownerId !== ownerId) {
		throw new Error('Forbidden');
	}
}

/**
 * Replace the ingredientChanges and directionChanges JSONB columns on the
 * given node. No diff, no new node — the client is authoritative for the
 * leaf's change arrays. See ADR 0001.
 *
 * Empty payload + undefined label = no-op; skip the DB write entirely and
 * return the current materialized state. Otherwise the writes go through
 * and the timestamp is bumped.
 */
export async function updateRecipeNode(
	payload: UpdateRecipeNodePayload,
	ownerId: string,
): Promise<RecipeState> {
	validatePayload(payload);
	await assertNodeOwnership(payload.nodeId, ownerId);

	const noChanges =
		payload.ingredientChanges.length === 0 && payload.directionChanges.length === 0;
	const noLabel = payload.label === undefined;
	if (noChanges && noLabel) {
		const root = await getRootRecipeNode(payload.nodeId);
		if (!root) throw new Error('Node not found');
		return applyNodes(await getRecipeNodesByRecipeId(root.id));
	}

	const set: {
		ingredientChanges: IngredientChange[];
		directionChanges: DirectionChange[];
		timestamp: Date;
		label?: string | null;
	} = {
		ingredientChanges: payload.ingredientChanges,
		directionChanges: payload.directionChanges,
		timestamp: new Date(),
	};
	if (payload.label !== undefined) {
		set.label = payload.label;
	}

	await db.update(recipeNodes).set(set).where(eq(recipeNodes.id, payload.nodeId));

	const root = await getRootRecipeNode(payload.nodeId);
	if (!root) throw new Error('Node not found');
	return applyNodes(await getRecipeNodesByRecipeId(root.id));
}


/**
 * A recipe as it appears in the list/tree UI. Each RecipeNode is its own
 * recipe; parentId points to the parent recipe's node.
 */
export interface RecipeSummary {
	id: string;
	name: string;
	/** Null for top-level (root) recipes. */
	parentId: string | null;
}

export interface RecipeTreeNode extends RecipeSummary {
	children: RecipeTreeNode[];
}

/**
 * Build the recipe hierarchy for the list UI, scoped to one owner.
 *
 * Every node is a recipe. The tree is rooted at nodes with parentId = null.
 * Each node's direct parent is identified by its parentId; we only add a
 * node to the tree if its parent already exists as a node (otherwise it
 * bubbles up to top-level).
 *
 * Filtered by ownerId at the database so unrelated recipes never reach JS.
 */
export async function getRecipeTree(ownerId: string): Promise<RecipeTreeNode[]> {
	const allRows: SelectRecipeNode[] = await db
		.select()
		.from(recipeNodes)
		.where(eq(recipeNodes.ownerId, ownerId));

	// Index every node by id for O(1) lookups and for building the tree in-place.
	const nodeMap = new Map<string, RecipeTreeNode>();
	for (const row of allRows) {
		nodeMap.set(row.id, { id: row.id, name: row.name, parentId: row.parentId, children: [] });
	}

	const topLevel: RecipeTreeNode[] = [];

	// Add each node as a child of its direct parent. If the parent is not in
	// nodeMap (shouldn't happen), treat it as top-level.
	for (const node of nodeMap.values()) {
		if (node.parentId === null) {
			topLevel.push(node);
		} else {
			const parent = nodeMap.get(node.parentId);
			if (parent) {
				parent.children.push(node);
			} else {
				// Orphaned node — treat as top-level.
				topLevel.push(node);
			}
		}
	}

	return topLevel;
}
