import type { RequestHandler } from './$types';
import { findDescendantSubstitutes } from '$lib/server/bo/recipenodesbo';

/**
 * GET /mise/api/recipe-node/[nodeId]/substitutes
 *
 * Returns every substitute change in any descendant of `nodeId` that
 * targets an ingredient or direction row that exists in the materialized
 * state of the chain up to and including `nodeId`. Used by the recipe
 * page to render "Subs" chips per row and a slide-out sidebar.
 *
 * Response: 200 { substitutes: { flat: DescendantSubstitute[],
 *   byRowId: Record<id, DescendantSubstitute[]>,
 *   byRowKind: Record<id, 'ingredient' | 'direction'> } }
 *   where DescendantSubstitute is `{ nodeId, nodeName, nodeSlug,
 *   changeType, text, targetId }`.
 *
 * Errors:   401 unauthenticated, 404 node not found, 403 not owner.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) {
		return new Response('Sign in first', { status: 401 });
	}

	const nodeId = params.nodeId;
	if (!nodeId || nodeId.trim().length === 0) {
		return new Response('Node not found', { status: 404 });
	}

	// findDescendantSubstitutes does the ownership check internally
	// and returns emptySubstitutes() if the root doesn't exist or
	// isn't owned. The empty-flat case maps to 404 here so the
	// client can distinguish "no data" from "not yours" / "no row".
	const substitutes = await findDescendantSubstitutes(nodeId, ownerId);
	if (substitutes.flat.length === 0) {
		// Distinguish the no-data case from forbidden/not-found by
		// re-checking ownership. Cheap (indexed lookup) and avoids
		// leaking the difference to unauthorized callers.
		const { db } = await import('$lib/server/db');
		const { recipeNodes } = await import('$lib/server/db/schema');
		const { eq } = await import('drizzle-orm');
		const rows = await db
			.select({ ownerId: recipeNodes.ownerId })
			.from(recipeNodes)
			.where(eq(recipeNodes.id, nodeId))
			.limit(1);
		if (rows.length === 0) return new Response('Node not found', { status: 404 });
		if (rows[0].ownerId !== ownerId) return new Response('Forbidden', { status: 403 });
	}

	return new Response(JSON.stringify({ substitutes }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};
