import {
	getRecipeTree,
	getRecipeNodesByRecipeIdV2,
	toUiRecipeNode,
	type RecipeTreeNode
} from '$lib/server/bo/recipenodesbo';
import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';
import { SEED_NODES } from '$lib/demo-seed';
import { computeGraphView } from '$lib/recipe-store.demo';

/**
 * Walk parentId upward from a node to its tree root, returning the root with
 * its full children intact — i.e. the whole tree the node belongs to.
 */
function findRoot(node: RecipeTreeNode, nodeMap: Map<string, RecipeTreeNode>): RecipeTreeNode {
	let cursor: RecipeTreeNode | undefined = node;
	while (cursor?.parentId) {
		const parent = nodeMap.get(cursor.parentId);
		if (!parent) break;
		cursor = parent;
	}
	return cursor!;
}

/**
 * Recursively collect every node id in a subtree (root + all descendants).
 */
function collectSubtreeIds(node: RecipeTreeNode): string[] {
	const ids: string[] = [node.id];
	for (const child of node.children) ids.push(...collectSubtreeIds(child));
	return ids;
}

/**
 * Shared loader for the whole-tree views (graph, log): the entire tree the
 * node identified by `slug` belongs to, with every branch intact, plus the
 * full node rows for that tree. The current node is highlighted client-side.
 */
export async function loadWholeTree(
	slug: string,
	ownerId: string | null,
	demoMode: boolean
): Promise<{ subtree: RecipeTreeNode | null; subtreeNodes: RecipeNode[] }> {
	let subtree: RecipeTreeNode | null = null;
	let subtreeNodes: RecipeNode[] = [];

	if (demoMode) {
		const graph = computeGraphView(SEED_NODES, slug);
		subtree = graph.subtree;
		subtreeNodes = graph.subtreeNodes;
	} else if (ownerId) {
		const fullTree = await getRecipeTree(ownerId);

		// Index every node by id for O(1) ancestor lookups.
		const nodeMap = new Map<string, RecipeTreeNode>();
		{
			const stack: RecipeTreeNode[] = [...fullTree];
			while (stack.length > 0) {
				const node = stack.pop()!;
				nodeMap.set(node.id, node);
				for (const child of node.children) stack.push(child);
			}
		}

		const currentSubtree = nodeMap.get(slug) ?? null;

		if (currentSubtree) {
			// The whole tree the node belongs to: walk up to the root and keep
			// every branch intact so siblings of ancestors are shown too.
			subtree = findRoot(currentSubtree, nodeMap);

			// Collect root-to-leaf ids for the entire lineage subtree.
			const allIds = collectSubtreeIds(subtree);
			// Batch-fetch full node rows (all change arrays intact).
			const rows = await db
				.select()
				.from(recipeNodes)
				.where(inArray(recipeNodes.id, allIds));
			subtreeNodes = rows.map(toUiRecipeNode);
		} else {
			// Node not in this user's tree — fall back to ancestor chain.
			subtreeNodes = await getRecipeNodesByRecipeIdV2(slug);
		}
	}

	return { subtree, subtreeNodes };
}
