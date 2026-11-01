import type { RequestHandler } from './$types';
import { toggleRecipeFavorite } from '$lib/server/bo/recipenodesbo';

/**
 * PATCH /mise/api/recipe-node/[nodeId]/favorite
 * Body: none. Each PATCH flips the favorite status for the authenticated user
 * in public.user_recipe_favorites.
 *
 * Allowed if the node is owned by the user OR marked as is_public = true.
 *
 * Response: 200 { isFavorite: boolean }
 * Errors:   401 unauthenticated, 403 forbidden (private foreign recipe), 404 node not found
 */
export const PATCH: RequestHandler = async ({ params, locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) {
		return new Response('Sign in first', { status: 401 });
	}

	const nodeId = params.nodeId;
	if (!nodeId || nodeId.trim().length === 0) {
		return new Response('Node not found', { status: 404 });
	}

	try {
		const result = await toggleRecipeFavorite(ownerId, nodeId);
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	} catch (e: unknown) {
		const status = (e as { status?: number })?.status ?? 500;
		const message = (e as Error)?.message ?? 'Internal Server Error';
		return new Response(message, { status });
	}
};
