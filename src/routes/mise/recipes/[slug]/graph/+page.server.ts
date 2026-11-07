import type { PageServerLoad } from './$types';
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
 * /mise/recipes/[slug]/graph
 *
 * Loads the whole recipe tree containing the node identified by `slug` (a
 * nodeId): every branch of the tree the node belongs to is rendered, with the
 * current node highlighted client-side. This gives full context — ancestor
 * siblings and descendant branches are all visible.
 *
 * If the slug is not part of the current user's tree we fall back to the
 * ancestor-chain loader used by the recipe page (which has no children).
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const { user } = await locals.safeGetSession();
	const ownerId = user?.id ?? null;
	const demoMode = Boolean((locals as any).demoMode);

	let subtree: RecipeTreeNode | null = null;
	let subtreeNodes: RecipeNode[] = [];

	if (demoMode) {
		const graph = computeGraphView(SEED_NODES, params.slug);
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

		const currentSubtree = nodeMap.get(params.slug) ?? null;

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
			subtreeNodes = await getRecipeNodesByRecipeIdV2(params.slug);
		}
	}

	return { subtree, subtreeNodes, currentId: params.slug, demoMode };
};
