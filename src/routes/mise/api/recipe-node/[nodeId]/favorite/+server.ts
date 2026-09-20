import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * PATCH /mise/api/recipe-node/[nodeId]/favorite
 * Body: none. Each PATCH flips the is_favorite flag (favorite → unfavorite,
 * unfavorite → favorite).
 *
 * The node must belong to the signed-in user. The endpoint mirrors the
 * `/public` endpoint shape: same auth checks, same JSON response.
 *
 * Response: 200 { isFavorite: boolean }
 * Errors:   401 unauthenticated, 403 not owner, 404 node not found
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

	const rows = await db
		.select({ ownerId: recipeNodes.ownerId, isFavorite: recipeNodes.isFavorite })
		.from(recipeNodes)
		.where(eq(recipeNodes.id, nodeId))
		.limit(1);
	if (rows.length === 0) {
		return new Response('Node not found', { status: 404 });
	}
	if (rows[0].ownerId !== ownerId) {
		return new Response('Forbidden', { status: 403 });
	}

	const next = !rows[0].isFavorite;
	await db
		.update(recipeNodes)
		.set({ isFavorite: next })
		.where(eq(recipeNodes.id, nodeId));

	return new Response(JSON.stringify({ isFavorite: next }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};
