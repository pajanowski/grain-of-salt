import type { RequestHandler } from './$types';
import {
	updateRecipeNode,
	InvalidChangeError,
	type UpdateRecipeNodePayload,
} from '$lib/server/bo/recipenodesbo';
import { DEMO_USER_ID } from '$lib/server/db/schema';

/**
 * Resolve the request's effective owner:
 *  - Authenticated Supabase user -> their own id.
 *  - Guest cookie only -> DEMO_USER_ID. Guests can save edits to demo
 *    recipes, but they are owned by the demo user.
 *
 * Returns null if neither is set; the caller should reject in that case.
 */
function resolveOwnerId(
	locals: App.Locals,
	cookies: { get: (name: string) => string | undefined }
): string | null {
	if (locals.user?.id) return locals.user.id;
	if (cookies.get('guest') === '1') return DEMO_USER_ID;
	return null;
}

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
export const PUT: RequestHandler = async ({ request, params, locals, cookies }) => {
	const ownerId = resolveOwnerId(locals, cookies);
	if (!ownerId) {
		return new Response('Sign in or continue as guest first', { status: 401 });
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
