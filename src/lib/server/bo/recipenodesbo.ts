import { asc, eq, sql } from 'drizzle-orm';
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

export async function createRootRecipeNode(
	name: string,
	ownerId: string,
	author?: string | null,
	source?: string | null,
	ingredientChanges: IngredientChange[] = [],
	directionChanges: DirectionChange[] = []
): Promise<RecipeNode> {
	const row: InsertRecipeNode = {
		parentId: null,
		ownerId,
		name,
		ingredientChanges,
		directionChanges,
		author: author ?? null,
		source: source ?? null
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
	author?: string | null
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
		ingredientChanges,
		directionChanges,
		author: author ?? null
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
 * owns the root.
 */
export async function getRecipeNodesByRecipeId(rootNodeId: string): Promise<RecipeNode[]> {
	const nodes: RecipeNode[] = [];
	let cursor: string | null = rootNodeId;
	const visited = new Set<string>();
	while (cursor !== null) {
		if (visited.has(cursor)) break; // cycle guard
		visited.add(cursor);
		const rows = await db.select().from(recipeNodes).where(eq(recipeNodes.id, cursor)).limit(1);
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
 * Pure function: replay an ordered list of nodes against an empty state.
 * Exported for testing and for callers who already have the nodes in hand.
 */
export function applyNodes(nodes: RecipeNode[]): RecipeState {
	const ingredients = new Map<string, Ingredient>();
	const directions = new Map<string, Direction>();
	// Track the latest note per item from add/edit changes; deleted on remove.
	const ingredientNotes = new Map<string, string | null>();
	const directionNotes = new Map<string, string | null>();
	// Track the latest imagePaths per item from add/edit changes. Per the
	// imagePaths replay contract: body.imagePaths === null (or missing)
	// means "fall through to ancestor's set"; body.imagePaths === []
	// means "cleared by this change"; body.imagePaths === [...] means
	// "replace with this set". We only touch the map when the body
	// explicitly carries the field.
	const ingredientImages = new Map<string, string[]>();
	const directionImages = new Map<string, string[]>();

	for (const node of nodes) {
		for (const change of node.ingredientChanges) {
			applyIngredientChange(ingredients, ingredientNotes, ingredientImages, change);
		}
		for (const change of node.directionChanges) {
			applyDirectionChange(directions, directionNotes, directionImages, change);
		}
	}

	const ingredientList = Array.from(ingredients.values()).map((ing) => ({
		...ing,
		note: ingredientNotes.get(ing.id) ?? null,
		// Final imagePaths comes from the per-row image map; if absent
		// (e.g. an add without body.imagePaths), the row renders
		// without images.
		imagePaths: ingredientImages.get(ing.id) ?? null
	}));
	const directionList = Array.from(directions.values()).map((dir) => ({
		...dir,
		note: directionNotes.get(dir.id) ?? null,
		imagePaths: directionImages.get(dir.id) ?? null
	}));

	return {
		ingredients: ingredientList,
		directions: directionList
	};
}

/**
 * Apply the imagePaths replay rule to the per-row image map. Called
 * from both applyIngredientChange and applyDirectionChange for any
 * change that carries a body. Skips when body.imagePaths is null or
 * undefined (fall-through) or when the change has no body at all
 * (e.g. remove).
 */
function applyImagePaths<T extends { id: string; imagePaths?: string[] | null }>(
	state: Map<string, T>,
	images: Map<string, string[]>,
	body: T | null | undefined
): void {
	if (!body || !('imagePaths' in body)) return;
	// explicit null = fall through (preserve ancestor's set)
	if (body.imagePaths === null || body.imagePaths === undefined) return;
	images.set(body.id, body.imagePaths);
}

function applyIngredientChange(
	state: Map<string, Ingredient>,
	notes: Map<string, string | null>,
	images: Map<string, string[]>,
	change: IngredientChange
): void {
	switch (change.changeType) {
		case 'add': {
			if (!change.body) return; // malformed: add requires a body
			const id = change.body.id || change.id;
			if (change.targetId !== null) {
				// Reorder-only claim: an ancestor already owns the body for
				// this row; the leaf just wants to move it to the end of
				// insertion order. Move-then-set with the existing body so a
				// later parent edit survives a fork-side reorder.
				if (state.has(id)) {
					const existing = state.get(id)!;
					state.delete(id);
					state.set(id, { ...existing, id });
				}
				return;
			}
			// Leaf owns the body (fresh add or reclaim). Delete-then-set:
			// when the same id is being re-added by a later node, `Map.set`
			// alone would leave the key at its original insertion position.
			// Deleting first moves the key to the end so leaf-emitted
			// additions control the final display order.
			if (state.has(id)) state.delete(id);
			if (notes.has(id)) notes.delete(id);
			state.set(id, { ...change.body, id });
			notes.set(id, change.note ?? null);
			applyImagePaths(state, images, change.body);
			return;
		}
		case 'edit':
		case 'substitute': {
			// 'substitute' is syntactic sugar over 'edit': same wire shape
			// (targetId + body), same materialize behavior. UI surfaces use
			// the changeType to pick a distinct color (blue vs amber), but
			// replay treats them identically.
			if (!change.targetId || !change.body) return; // malformed
			if (state.has(change.targetId)) {
				state.set(change.targetId, { ...change.body, id: change.targetId });
				notes.set(change.targetId, change.note ?? null);
				applyImagePaths(state, images, change.body);
			}
			return;
		}
		case 'remove': {
			if (change.targetId) {
				state.delete(change.targetId);
				notes.delete(change.targetId);
				images.delete(change.targetId);
			}
			return;
		}
	}
}

function applyDirectionChange(
	state: Map<string, Direction>,
	notes: Map<string, string | null>,
	images: Map<string, string[]>,
	change: DirectionChange
): void {
	switch (change.changeType) {
		case 'add': {
			if (!change.body) return;
			const id = change.body.id || change.id;
			if (change.targetId !== null) {
				// See applyIngredientChange above: reorder-only claim.
				if (state.has(id)) {
					const existing = state.get(id)!;
					state.delete(id);
					state.set(id, { ...existing, id });
				}
				return;
			}
			// Leaf owns the body.
			if (state.has(id)) state.delete(id);
			if (notes.has(id)) notes.delete(id);
			state.set(id, { ...change.body, id });
			notes.set(id, change.note ?? null);
			applyImagePaths(state, images, change.body);
			return;
		}
		case 'edit':
		case 'substitute': {
			// See applyIngredientChange: 'substitute' is syntactic sugar over
			// 'edit', same wire shape and same materialize behavior. UI uses
			// changeType for color only.
			if (!change.targetId || !change.body) return;
			if (state.has(change.targetId)) {
				state.set(change.targetId, { ...change.body, id: change.targetId });
				notes.set(change.targetId, change.note ?? null);
				applyImagePaths(state, images, change.body);
			}
			return;
		}
		case 'remove': {
			if (change.targetId) {
				state.delete(change.targetId);
				notes.delete(change.targetId);
				images.delete(change.targetId);
			}
			return;
		}
	}
}

export function toUiRecipeNode(row: SelectRecipeNode): RecipeNode {
	return {
		id: row.id,
		name: row.name,
		parentId: row.parentId,
		timestamp: row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp),
		ingredientChanges: (row.ingredientChanges ?? []) as IngredientChange[],
		directionChanges: (row.directionChanges ?? []) as DirectionChange[],
		author: row.author ?? null,
		source: row.source ?? null,
		isPublic: row.isPublic ?? false,
		isFavorite: row.isFavorite ?? false,
		imagePath: row.imagePath ?? null
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
	if (op !== 'add' && op !== 'edit' && op !== 'remove' && op !== 'substitute') {
		throw new InvalidChangeError(
			`ingredientChanges[${index}].changeType must be 'add' | 'edit' | 'remove' | 'substitute'`
		);
	}
	if (op === 'add') {
		if (obj.targetId !== null && (typeof obj.targetId !== 'string' || obj.targetId.length === 0)) {
			throw new InvalidChangeError(
				`ingredientChanges[${index}] (add) must have targetId === null or a non-empty string`
			);
		}
		if (!obj.body || typeof obj.body !== 'object') {
			throw new InvalidChangeError(`ingredientChanges[${index}] (add) must have a body`);
		}
		validateIngredientBodyImagePaths(obj.body as Record<string, unknown>, index);
	} else if (op === 'edit' || op === 'substitute') {
		// 'substitute' is syntactic sugar over 'edit': same wire shape
		// (targetId + body), same materialize behavior. UI surfaces use
		// the changeType for color (blue vs amber) but the validator
		// enforces identical shape requirements.
		if (typeof obj.targetId !== 'string' || obj.targetId.length === 0) {
			throw new InvalidChangeError(`ingredientChanges[${index}] (${op}) must have a targetId`);
		}
		if (!obj.body || typeof obj.body !== 'object') {
			throw new InvalidChangeError(`ingredientChanges[${index}] (${op}) must have a body`);
		}
		validateIngredientBodyImagePaths(obj.body as Record<string, unknown>, index);
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

/**
 * Validate the optional imagePaths field on an ingredient change body.
 * Allowed shapes: undefined / null (fall-through), string[] (replace
 * with this set, including [] for explicit clear). Reject anything
 * else (e.g. strings, objects, numbers) — the wire shape is strict.
 */
function validateIngredientBodyImagePaths(body: Record<string, unknown>, changeIndex: number): void {
	if (!('imagePaths' in body) || body.imagePaths === null || body.imagePaths === undefined) return;
	if (!Array.isArray(body.imagePaths)) {
		throw new InvalidChangeError(
			`ingredientChanges[${changeIndex}].body.imagePaths must be an array of strings when present`
		);
	}
	for (const [i, p] of body.imagePaths.entries()) {
		if (typeof p !== 'string' || p.length === 0) {
			throw new InvalidChangeError(
				`ingredientChanges[${changeIndex}].body.imagePaths[${i}] must be a non-empty string`
			);
		}
	}
}

/**
 * Direction-body imagePaths validator. Mirrors the ingredient version
 * above — the field lives on the change body and uses the same
 * null/[]/[...] replay contract.
 */
function validateDirectionBodyImagePaths(body: Record<string, unknown>, changeIndex: number): void {
	if (!('imagePaths' in body) || body.imagePaths === null || body.imagePaths === undefined) return;
	if (!Array.isArray(body.imagePaths)) {
		throw new InvalidChangeError(
			`directionChanges[${changeIndex}].body.imagePaths must be an array of strings when present`
		);
	}
	for (const [i, p] of body.imagePaths.entries()) {
		if (typeof p !== 'string' || p.length === 0) {
			throw new InvalidChangeError(
				`directionChanges[${changeIndex}].body.imagePaths[${i}] must be a non-empty string`
			);
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
	if (op !== 'add' && op !== 'edit' && op !== 'remove' && op !== 'substitute') {
		throw new InvalidChangeError(
			`directionChanges[${index}].changeType must be 'add' | 'edit' | 'remove' | 'substitute'`
		);
	}
	if (op === 'add') {
		if (obj.targetId !== null && (typeof obj.targetId !== 'string' || obj.targetId.length === 0)) {
			throw new InvalidChangeError(
				`directionChanges[${index}] (add) must have targetId === null or a non-empty string`
			);
		}
		if (!obj.body || typeof obj.body !== 'object') {
			throw new InvalidChangeError(`directionChanges[${index}] (add) must have a body`);
		}
		validateDirectionBodyImagePaths(obj.body as Record<string, unknown>, index);
	} else if (op === 'edit' || op === 'substitute') {
		// See ingredient validator: 'substitute' has the same shape as
		// 'edit' (targetId + body); the changeType only differs for UI
		// color.
		if (typeof obj.targetId !== 'string' || obj.targetId.length === 0) {
			throw new InvalidChangeError(`directionChanges[${index}] (${op}) must have a targetId`);
		}
		if (!obj.body || typeof obj.body !== 'object') {
			throw new InvalidChangeError(`directionChanges[${index}] (${op}) must have a body`);
		}
		validateDirectionBodyImagePaths(obj.body as Record<string, unknown>, index);
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
	author?: string | null
): Promise<RecipeState> {
	validatePayload(payload);
	await assertNodeOwnership(payload.nodeId, ownerId);

	const noChanges = payload.ingredientChanges.length === 0 && payload.directionChanges.length === 0;
	if (noChanges) {
		const root = await getRootRecipeNode(payload.nodeId);
		if (!root) throw new Error('Node not found');
		return applyNodes(await getRecipeNodesByRecipeId(root.id));
	}

	const set: {
		ingredientChanges: IngredientChange[];
		directionChanges: DirectionChange[];
		timestamp: Date;
		author?: string | null;
	} = {
		ingredientChanges: payload.ingredientChanges,
		directionChanges: payload.directionChanges,
		timestamp: new Date()
	};
	// First-edit-wins: only write author when the node has no author yet.
	if (author != null) {
		set.author = author;
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
/**
 * Find every substitute change in any descendant of `rootNodeId` that
 * refers to a row of the root. The crawler walks the chain via
 * `parent_id` (same as the migration-level recursive function) and
 * collects `substitute` change records whose `targetId` matches an
 * ingredient or direction id that exists in the materialized state of
 * the chain up to and including `rootNodeId`.
 *
 * Why 'descendants' rather than 'all nodes in the chain':
 *
 *  - The chain represents history: parent_id points at the previous
 *    node in the same recipe. When you fork from node X, the new node
 *    Y has parent_id = X.id. Y's edits, removes, and substitutes
 *    operate on the rows that exist as of X. A substitute that targets
 *    a row that exists only after X is meaningless to X.
 *
 *  - We bound the look-back to the materialized state of the chain up
 *    to `rootNodeId` so the crawler doesn't pick up rows introduced by
 *    an intervening ancestor fork. That keeps the "substitutes
 *    available" panel from showing ghosts.
 *
 * Used by the recipe page to render a "Substitutes available"
 * section. Returns the display text (already formatted via the diff
 * helper) and a link to the source descendant node.
 */
export interface DescendantSubstitute {
	/** The descendant recipe node that authored the substitute. */
	nodeId: string;
	/** Display name of the source descendant node. */
	nodeName: string;
	/** Slug for linking into `/mise/recipes/[slug]`. */
	nodeSlug: string;
	/** Was the substitute on an ingredient row or a direction row? */
	changeType: 'ingredient' | 'direction';
	/** Display-ready summary the panel renders for this entry —
	 *  e.g. "SUB 1 tbsp Olive oil" or "SUB Oil-based sauté." */
	text: string;
	/** Stable row id that this substitute targets (matches
	 *  `Ingredient.id` / `Direction.id` at the time the root node
	 *  was the current view). Ingredient and direction ids share
	 *  the same keyspace in this codebase — callers must match by
	 *  `changeType` as well. */
	targetId: string;
}

/**
 * Result of `findDescendantSubstitutes`. Two views on the same data:
 *  - `flat`: every descendant substitute, in CTE walk order. Useful
 *    when the caller wants a single "Substitutes available" panel.
 *  - `byRowId`: same substitutes keyed by the row they target, with
 *    the row's kind stored separately in `byRowKind`. Useful when
 *    the caller renders a per-row "Subs" chip on the leaf and wants
 *    to look up "what substitutes exist for this exact row".
 */
export interface DescendantSubstitutes {
	flat: DescendantSubstitute[];
	byRowId: Record<string, DescendantSubstitute[]>;
	byRowKind: Record<string, 'ingredient' | 'direction'>;
}

export async function findDescendantSubstitutes(
	rootNodeId: string,
	ownerId?: string | null
): Promise<DescendantSubstitutes> {
	// Ownership gate: when called from an authenticated route, only
	// return substitutes if the root node belongs to `ownerId`. When
	// called without ownerId (e.g. internal tooling) skip the check.
	if (ownerId != null) {
		const ownRows: { ownerId: string | null }[] = await db
			.select({ ownerId: recipeNodes.ownerId })
			.from(recipeNodes)
			.where(eq(recipeNodes.id, rootNodeId))
			.limit(1);
		if (ownRows.length === 0) return emptySubstitutes();
		if (ownRows[0].ownerId !== ownerId) return emptySubstitutes();
	}

	// 1. Compute the set of row ids visible at rootNodeId by replaying
	//    the chain from the topmost ancestor down through rootNodeId.
	//    Substitutes in descendants that target rows that don't exist
	//    at this point are skipped — they reference ancestor rows
	//    that the descendant's recipe branch has since removed.
	const chain = await getRecipeNodesByRecipeId(rootNodeId);
	const visible = applyNodes(chain);
	const visibleIngredientIds = new Set(visible.ingredients.map((i) => i.id));
	const visibleDirectionIds = new Set(visible.directions.map((d) => d.id));

	// 2. Walk every descendant of rootNodeId via a recursive CTE on
	//    parent_id. Each descendant carries its full change arrays.
	type DescRow = {
		id: string;
		name: string;
		ingredientChanges: IngredientChange[];
		directionChanges: DirectionChange[];
	};
	// Drizzle's `db.execute` on postgres-js returns the rows directly
	// (not a QueryResult wrapper) when given a typed row parameter.
	const descRows = await db.execute<DescRow>(sql`
		with recursive descendants as (
			select id, name, ingredient_changes, direction_changes, parent_id
			from recipe_nodes
			where parent_id = ${rootNodeId}
			union all
			select rn.id, rn.name, rn.ingredient_changes, rn.direction_changes, rn.parent_id
			from recipe_nodes rn
			inner join descendants d on rn.parent_id = d.id
		)
		select
			id,
			name,
			ingredient_changes as "ingredientChanges",
			direction_changes as "directionChanges"
		from descendants
	`);

	// 3. Collect substitute changes that target a row visible at the
	//    time of rootNodeId. Each is enriched with its source node's
	//    id+name so the caller can render a link.
	const flat: DescendantSubstitute[] = [];
	const byRowId: Record<string, DescendantSubstitute[]> = {};
	const byRowKind: Record<string, 'ingredient' | 'direction'> = {};
	for (const row of descRows) {
		for (const c of row.ingredientChanges as IngredientChange[]) {
			if (c.changeType !== 'substitute') continue;
			if (!c.targetId || !c.body) continue;
			if (!visibleIngredientIds.has(c.targetId)) continue;
			const entry: DescendantSubstitute = {
				nodeId: row.id,
				nodeName: row.name,
				nodeSlug: row.id,
				changeType: 'ingredient',
				text: 'SUB ' + formatIngredientChangeText(c.body),
				targetId: c.targetId
			};
			flat.push(entry);
			(byRowId[c.targetId] ??= []).push(entry);
			byRowKind[c.targetId] = 'ingredient';
		}
		for (const c of row.directionChanges as DirectionChange[]) {
			if (c.changeType !== 'substitute') continue;
			if (!c.targetId || !c.body) continue;
			if (!visibleDirectionIds.has(c.targetId)) continue;
			const entry: DescendantSubstitute = {
				nodeId: row.id,
				nodeName: row.name,
				nodeSlug: row.id,
				changeType: 'direction',
				text: 'SUB ' + formatDirectionChangeText(c.body),
				targetId: c.targetId
			};
			flat.push(entry);
			(byRowId[c.targetId] ??= []).push(entry);
			byRowKind[c.targetId] = 'direction';
		}
	}
	return { flat, byRowId, byRowKind };
}

function emptySubstitutes(): DescendantSubstitutes {
	return { flat: [], byRowId: {}, byRowKind: {} };
}

function formatIngredientChangeText(body: {
	name: string;
	amount?: number;
	unit?: string;
}): string {
	const parts: string[] = [];
	if (body.amount) parts.push(String(body.amount));
	if (body.unit) parts.push(body.unit);
	parts.push(body.name);
	return parts.filter(Boolean).join(' ').trim() || 'ingredient';
}

function formatDirectionChangeText(body: { body: string }): string {
	return body.body || '(empty)';
}

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
