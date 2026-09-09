import type { PageServerLoad } from './$types';
import {
	getRecipeTree,
	getRecipeNodesByRecipeIdV2,
	toUiRecipeNode,
	type RecipeTreeNode,
} from '$lib/server/bo/recipenodesbo';
import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';

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
 * Loads the lineage rooted at the recipe node identified by `slug` (a nodeId):
 * ancestors (root → … → current) plus the current node's descendants. We need
 * the whole lineage because navigating here from a child node is meaningless
 * without the context of how we got here.
 *
 * The lineage is collapsed into a chain — each ancestor's `children` is
 * replaced with only the next link in the chain, so the rendered DAG is the
 * single path from root to current, then fanning out into current's subtree.
 * Siblings of the current node (other children of its parent) are intentionally
 * omitted: the graph represents the history of this recipe, not the broader
 * authoring graph.
 *
 * If the slug is not part of the current user's tree we fall back to the
 * ancestor-chain loader used by the recipe page (which has no children).
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const { user } = await locals.safeGetSession();
	const ownerId = user?.id ?? null;

	let subtree: RecipeTreeNode | null = null;
	let subtreeNodes: RecipeNode[] = [];

	if (ownerId) {
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
			// Walk parentId upward, collecting the lineage in walk order
			// (current → … → root). We stop if a parent isn't part of this
			// user's tree (e.g. cross-owner ancestry edge case).
			const lineage: RecipeTreeNode[] = [currentSubtree];
			let cursor: RecipeTreeNode | undefined = currentSubtree;
			while (cursor?.parentId) {
				const parent = nodeMap.get(cursor.parentId);
				if (!parent) break;
				lineage.push(parent);
				cursor = parent;
			}
			// Collapse siblings: each ancestor's children becomes only the next
			// link in the chain. The leaf (current) keeps its existing subtree.
			for (let i = 0; i < lineage.length - 1; i++) {
				lineage[i + 1].children = [lineage[i]];
			}
			// lineage is current-first; root is the last element.
			subtree = lineage[lineage.length - 1];

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

	return { subtree, subtreeNodes, currentId: params.slug };
};
