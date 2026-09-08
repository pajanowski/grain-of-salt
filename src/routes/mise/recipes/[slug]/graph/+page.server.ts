import type { PageServerLoad } from './$types';
import {
	getRecipeTree,
	getRecipeNodesByRecipeIdV2,
} from '$lib/server/bo/recipenodesbo';
import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';
import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';
import { toUiRecipeNode } from '$lib/server/bo/recipenodesbo';

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
 * Loads the subtree rooted at the recipe node identified by `slug` (a nodeId),
 * then renders it as an interactive graph.  Unlike the ancestor-chain loader
 * used on the recipe page, this fetches every node in the subtree so the full
 * tree structure is visible.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const { user } = await locals.safeGetSession();
	const ownerId = user?.id ?? null;

	let subtree: RecipeTreeNode | null = null;
	let subtreeNodes: RecipeNode[] = [];

	if (ownerId) {
		const fullTree = await getRecipeTree(ownerId);
		subtree = findSubtree(fullTree, params.slug);

		if (subtree) {
			// Collect root-to-leaf ids for the entire subtree.
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

	return { subtree, subtreeNodes, currentId: params.slug };
};

function findSubtree(nodes: RecipeTreeNode[], id: string): RecipeTreeNode | null {
	for (const node of nodes) {
		if (node.id === id) return node;
		const found = findSubtree(node.children, id);
		if (found) return found;
	}
	return null;
}
