import type { PageServerLoad } from './$types';
import { loadWholeTree } from '$lib/server/bo/graph-view';

/**
 * /mise/recipes/[slug]/log
 *
 * Loads the whole recipe tree containing the node identified by `slug` (a
 * nodeId) — the same data the graph view uses — so the log can render a
 * git-style commit graph (branch/merge rail) with every node in the tree.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const { user } = await locals.safeGetSession();
	const ownerId = user?.id ?? null;
	const demoMode = Boolean((locals as any).demoMode);

	const { subtree, subtreeNodes } = await loadWholeTree(params.slug, ownerId, demoMode);

	return { subtree, subtreeNodes, currentId: params.slug, demoMode };
};
