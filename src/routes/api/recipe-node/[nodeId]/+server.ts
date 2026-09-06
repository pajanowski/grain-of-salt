import type { RequestHandler } from './$types';
import {
	updateRecipeNode,
	InvalidChangeError,
	type UpdateRecipeNodePayload
} from '$lib/server/bo/recipenodesbo';

/**
 * PUT /api/recipe-node/[nodeId]
 *
 * Body:
 *   {
 *     nodeId: string,
 *     ingredientChanges: IngredientChange[],
 *     directionChanges: DirectionChange[],
 *     label?: string | null
 *   }
 *
 * Replaces the leaf node's JSONB change columns. Does NOT create a new node —
 * fork is the only path that does. See ADR 0001.
 *
 * Response: the materialized recipe state after the write (so the client can
 * sync without a separate fetch). On validation / ownership failures, a 4xx
 * with a plain-text body.
 */
export const PUT: RequestHandler = async ({ request, params, locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) {
		return new Response('Sign in first', { status: 401 });
	}

	if (!params.nodeId || params.nodeId.trim().length === 0) {
		return new Response('Node not found', { status: 404 });
	}

	let body: UpdateRecipeNodePayload;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	try {
		const state = await updateRecipeNode(body, ownerId);
		return new Response(JSON.stringify(state), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	} catch (e) {
		if (e instanceof InvalidChangeError) {
			return new Response(e.message, { status: 400 });
		}
		const msg = (e as Error).message;
		if (msg === 'Forbidden') return new Response(msg, { status: 403 });
		if (msg === 'Node not found') return new Response(msg, { status: 404 });
		return new Response(msg, { status: 500 });
	}
};
