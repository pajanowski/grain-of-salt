import type { PageServerLoad } from './$types';
import { loadWholeTree } from '$lib/server/bo/graph-view';

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

	const { subtree, subtreeNodes } = await loadWholeTree(params.slug, ownerId, demoMode);

	return { subtree, subtreeNodes, currentId: params.slug, demoMode };
};
