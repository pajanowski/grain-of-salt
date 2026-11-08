import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { recipeNodes, userRecipeFavorites, profiles } from '../db/schema';
import type { InsertRecipeNode, SelectRecipeNode } from '../db/schema';
import type { Ingredient, Direction } from '$lib/obj/Recipe.svelte';
import type { RecipeNode, IngredientChange, DirectionChange } from '$lib/obj/RecipeNode.svelte';
import { applyNodes, type RecipeState } from '$lib/recipe-apply';
import { displayDirectionBody } from '$lib/obj/recipeDiff';
export { applyNodes, type RecipeState };

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
 * Look up just the owner of a node. Cheap companion to the ownership gate:
 * the UI chain loaders drop `ownerId`, but the private page needs to know
 * whether the signed-in user may edit the node it renders.
 */
export async function getRecipeNodeOwnerId(nodeId: string): Promise<string | null> {
	const rows = await db
		.select({ ownerId: recipeNodes.ownerId })
		.from(recipeNodes)
		.where(eq(recipeNodes.id, nodeId))
		.limit(1);
	return rows[0]?.ownerId ?? null;
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
		imagePath: row.imagePath ?? null,
		description: row.description ?? null,
		note: row.note ?? null
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
function validateIngredientBodyImagePaths(
	body: Record<string, unknown>,
	changeIndex: number
): void {
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
 * Wire payload for `PATCH /api/recipe-node/[nodeId]/details`. Only the
 * keys present in the payload are written; absent keys keep their current
 * value.
 */
export interface UpdateNodeDetailsPayload {
	description?: string | null;
	note?: string | null;
}

/**
 * Set the node-level description and/or note (the metadata fields shown
 * under the recipe title and in the notes popout). Metadata only — the
 * replay pass ignores both, so writing them never bumps the node's
 * `timestamp` and never forks a new node.
 */
export async function updateRecipeNodeDetails(
	nodeId: string,
	ownerId: string,
	details: UpdateNodeDetailsPayload
): Promise<void> {
	await assertNodeOwnership(nodeId, ownerId);

	const set: { description?: string | null; note?: string | null } = {};
	if ('description' in details) {
		set.description = details.description === null ? null : details.description!.trim() || null;
	}
	if ('note' in details) {
		set.note = details.note === null ? null : details.note!.trim() || null;
	}
	if (Object.keys(set).length === 0) return;

	await db.update(recipeNodes).set(set).where(eq(recipeNodes.id, nodeId));
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
	// Compiled ingredients used to resolve `#<uuid>` refs when the
	// substitute's direction body is formatted for display below.
	const visibleIngredients = visible.ingredients;

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
				text: 'SUB ' + formatDirectionChangeText(c.body, visibleIngredients),
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

function formatDirectionChangeText(
	body: { body: string },
	ingredients: Ingredient[]
): string {
	if (!body.body) return '(empty)';
	// Resolve `#<uuid>` ingredient references against the ingredients
	// visible at the node the panel is opened from; unknown ids stay raw.
	return displayDirectionBody(body.body, ingredients);
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

export interface RecipeDashboardEntry {
	rootId: string;
	name: string;
	forkCount: number; // direct children only
	lastEditedAt: Date; // most recent write across root + descendants
	leafId: string; // the node that produced lastEditedAt
}

function extractNodeDate(row: SelectRecipeNode): Date {
	const val = row.updatedAt ?? row.timestamp;
	return val instanceof Date ? val : new Date(val);
}

export function computeRecipeDashboard(
	allRows: SelectRecipeNode[],
	limit = 5
): RecipeDashboardEntry[] {
	if (allRows.length === 0) return [];

	const nodeMap = new Map<string, SelectRecipeNode>();
	for (const row of allRows) {
		nodeMap.set(row.id, row);
	}

	function findRoot(node: SelectRecipeNode): SelectRecipeNode {
		let curr = node;
		const visited = new Set<string>();
		while (curr.parentId !== null) {
			if (visited.has(curr.id)) break;
			visited.add(curr.id);
			const parent = nodeMap.get(curr.parentId);
			if (!parent) break;
			curr = parent;
		}
		return curr;
	}

	const rootGroups = new Map<string, { root: SelectRecipeNode; nodes: SelectRecipeNode[] }>();
	for (const row of allRows) {
		const root = findRoot(row);
		let group = rootGroups.get(root.id);
		if (!group) {
			group = { root, nodes: [] };
			rootGroups.set(root.id, group);
		}
		group.nodes.push(row);
	}

	const entries: RecipeDashboardEntry[] = [];
	for (const group of rootGroups.values()) {
		let directChildrenCount = 0;
		for (const node of group.nodes) {
			if (node.parentId === group.root.id) {
				directChildrenCount++;
			}
		}

		let maxDate = extractNodeDate(group.root);
		let leafNode = group.root;

		for (const node of group.nodes) {
			const d = extractNodeDate(node);
			if (d.getTime() >= maxDate.getTime()) {
				maxDate = d;
				leafNode = node;
			}
		}

		entries.push({
			rootId: group.root.id,
			name: leafNode.name,
			forkCount: directChildrenCount,
			lastEditedAt: maxDate,
			leafId: leafNode.id
		});
	}

	entries.sort((a, b) => b.lastEditedAt.getTime() - a.lastEditedAt.getTime());
	return entries.slice(0, limit);
}

export async function getRecipeDashboard(
	ownerId: string,
	limit = 5
): Promise<RecipeDashboardEntry[]> {
	const allRows: SelectRecipeNode[] = await db
		.select()
		.from(recipeNodes)
		.where(eq(recipeNodes.ownerId, ownerId));

	return computeRecipeDashboard(allRows, limit);
}

export interface RecipeFavoriteEntry {
	id: string;
	name: string;
	lastEditedAt: Date;
	authorName?: string | null;
	isOwner?: boolean;
	urlPath?: string;
}

export function computeRecipeFavorites(allRows: SelectRecipeNode[]): RecipeFavoriteEntry[] {
	const favorites = allRows.filter((r) => r.isFavorite);
	return favorites
		.map((row) => ({
			id: row.id,
			name: row.name,
			lastEditedAt: extractNodeDate(row),
			authorName: null,
			isOwner: true,
			urlPath: `/mise/recipes/${row.id}`
		}))
		.sort((a, b) => b.lastEditedAt.getTime() - a.lastEditedAt.getTime());
}

export async function isRecipeFavorited(userId: string, recipeNodeId: string): Promise<boolean> {
	const rows = await db
		.select({ recipeNodeId: userRecipeFavorites.recipeNodeId })
		.from(userRecipeFavorites)
		.where(
			and(
				eq(userRecipeFavorites.userId, userId),
				eq(userRecipeFavorites.recipeNodeId, recipeNodeId)
			)
		)
		.limit(1);
	return rows.length > 0;
}

export async function getFavoritesBatch(
	userId: string,
	recipeNodeIds: string[]
): Promise<Record<string, boolean>> {
	const result: Record<string, boolean> = {};
	for (const id of recipeNodeIds) {
		result[id] = false;
	}
	if (recipeNodeIds.length === 0) {
		return result;
	}
	const rows = await db
		.select({ recipeNodeId: userRecipeFavorites.recipeNodeId })
		.from(userRecipeFavorites)
		.where(
			and(
				eq(userRecipeFavorites.userId, userId),
				inArray(userRecipeFavorites.recipeNodeId, recipeNodeIds)
			)
		);
	for (const row of rows) {
		result[row.recipeNodeId] = true;
	}
	return result;
}

export async function toggleRecipeFavorite(
	userId: string,
	recipeNodeId: string
): Promise<{ isFavorite: boolean }> {
	const nodeRows = await db
		.select({ ownerId: recipeNodes.ownerId, isPublic: recipeNodes.isPublic })
		.from(recipeNodes)
		.where(eq(recipeNodes.id, recipeNodeId))
		.limit(1);

	if (nodeRows.length === 0) {
		const err = new Error('Recipe node not found');
		(err as { status?: number }).status = 404;
		throw err;
	}

	const node = nodeRows[0];
	if (node.ownerId !== userId && !node.isPublic) {
		const err = new Error('Forbidden');
		(err as { status?: number }).status = 403;
		throw err;
	}

	const isCurrentlyFavorited = await isRecipeFavorited(userId, recipeNodeId);

	if (isCurrentlyFavorited) {
		await db
			.delete(userRecipeFavorites)
			.where(
				and(
					eq(userRecipeFavorites.userId, userId),
					eq(userRecipeFavorites.recipeNodeId, recipeNodeId)
				)
			);
		if (node.ownerId === userId) {
			await db
				.update(recipeNodes)
				.set({ isFavorite: false })
				.where(eq(recipeNodes.id, recipeNodeId));
		}
		return { isFavorite: false };
	} else {
		await db
			.insert(userRecipeFavorites)
			.values({ userId, recipeNodeId })
			.onConflictDoNothing();
		if (node.ownerId === userId) {
			await db
				.update(recipeNodes)
				.set({ isFavorite: true })
				.where(eq(recipeNodes.id, recipeNodeId));
		}
		return { isFavorite: true };
	}
}

export async function getRecipeFavorites(
	userId: string,
	limit?: number,
	offset?: number
): Promise<RecipeFavoriteEntry[]> {
	const rows = await db
		.select({
			recipeNodeId: userRecipeFavorites.recipeNodeId,
			createdAt: userRecipeFavorites.createdAt,
			nodeId: recipeNodes.id,
			name: recipeNodes.name,
			ownerId: recipeNodes.ownerId,
			author: recipeNodes.author,
			updatedAt: recipeNodes.updatedAt,
			timestamp: recipeNodes.timestamp,
			displayName: profiles.displayName
		})
		.from(userRecipeFavorites)
		.innerJoin(recipeNodes, eq(userRecipeFavorites.recipeNodeId, recipeNodes.id))
		.leftJoin(profiles, eq(recipeNodes.ownerId, profiles.id))
		.where(eq(userRecipeFavorites.userId, userId))
		.orderBy(desc(userRecipeFavorites.createdAt));

	const sliced = typeof limit === 'number' ? rows.slice(offset ?? 0, (offset ?? 0) + limit) : rows;

	return sliced.map((row) => {
		const isOwner = row.ownerId === userId;
		const authorName = isOwner ? null : (row.displayName || row.author || 'Community Chef');
		const urlPath = isOwner ? `/mise/recipes/${row.nodeId}` : `/recipe/${row.nodeId}`;
		const lastEditedAt = row.updatedAt ?? row.timestamp;
		return {
			id: row.nodeId,
			name: row.name,
			lastEditedAt: lastEditedAt instanceof Date ? lastEditedAt : new Date(lastEditedAt),
			authorName,
			isOwner,
			urlPath
		};
	});
}
