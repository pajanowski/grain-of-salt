import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * PATCH /mise/api/recipe-node/[nodeId]/favorite
 * Body: { isFavorite: boolean }
 *
 * Sets or clears the is_favorite flag on a recipe node. The node must
 * belong to the signed-in user.
 *
 * Response: 200 { isFavorite: boolean }
 * Errors:   401 unauthenticated, 403 not owner, 404 node not found
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) {
		return new Response('Sign in first', { status: 401 });
	}

	const nodeId = params.nodeId;
	if (!nodeId || nodeId.trim().length === 0) {
		return new Response('Node not found', { status: 404 });
	}

	// Verify ownership before writing.
	const rows = await db
		.select({ ownerId: recipeNodes.ownerId })
		.from(recipeNodes)
		.where(eq(recipeNodes.id, nodeId))
		.limit(1);
	if (rows.length === 0) {
		return new Response('Node not found', { status: 404 });
	}
	if (rows[0].ownerId !== ownerId) {
		return new Response('Forbidden', { status: 403 });
	}

	let body: { isFavorite?: unknown };
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	if (typeof body.isFavorite !== 'boolean') {
		return new Response('isFavorite must be a boolean', { status: 400 });
	}

	await db
		.update(recipeNodes)
		.set({ isFavorite: body.isFavorite })
		.where(eq(recipeNodes.id, nodeId));

	return new Response(JSON.stringify({ isFavorite: body.isFavorite }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};
