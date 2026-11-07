import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';

/**
 * Enforce the graph's vertical invariant: for every parent → child edge, the
 * child's top edge is strictly below the parent's bottom edge
 * (parent max-y < child start-y).
 *
 * `baseTop`/`height` describe each node's position in the base layout (dagre
 * returns centre y; the base top is `centre - height / 2`). A node that
 * already satisfies the invariant keeps its base top; a node that would start
 * at or above its parent's bottom is pushed down to `parent bottom + gap`,
 * and the push cascades to its descendants. Only the node's own subtree moves,
 * so layouts where every node owns a disjoint x slot are unaffected.
 */
export function resolveTops(
	tree: RecipeTreeNode,
	baseTop: (id: string) => number,
	height: (id: string) => number,
	gap: number
): Map<string, number> {
	const topOf = new Map<string, number>();
	const walk = (node: RecipeTreeNode, minY: number): void => {
		const top = Math.max(baseTop(node.id), minY);
		topOf.set(node.id, top);
		for (const child of node.children) {
			walk(child, top + height(node.id) + gap);
		}
	};
	walk(tree, baseTop(tree.id));
	return topOf;
}
