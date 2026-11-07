import type { RequestHandler } from './$types';
import { updateRecipeNodeDetails } from '$lib/server/bo/recipenodesbo';

/**
 * PATCH /api/recipe-node/[nodeId]/details
 *
 * Body: `{ description?: string | null, note?: string | null }`
 *
 * Sets the node-level description and/or note. Only keys present in the
 * body are written; `null` clears the field, `""` normalizes to `null`.
 * Metadata-only write: no timestamp bump, no fork.
 *
 * On ownership failures, a 4xx with a plain-text body (same mapping as
 * the sibling routes).
 */
export const PATCH: RequestHandler = async ({ request, params, locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) {
		return new Response('Sign in first', { status: 401 });
	}

	if (!params.nodeId || params.nodeId.trim().length === 0) {
		return new Response('Node not found', { status: 404 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	const details: { description?: string | null; note?: string | null } = {};
	for (const key of ['description', 'note'] as const) {
		if (!(key in body)) continue;
		const value = body[key];
		if (value !== null && typeof value !== 'string') {
			return new Response(`${key} must be a string or null`, { status: 400 });
		}
		details[key] = value as string | null;
	}

	try {
		await updateRecipeNodeDetails(params.nodeId, ownerId, details);
		return new Response(null, { status: 200 });
	} catch (e) {
		const msg = (e as Error).message;
		if (msg === 'Forbidden') return new Response(msg, { status: 403 });
		if (msg === 'Node not found') return new Response(msg, { status: 404 });
		return new Response(msg, { status: 500 });
	}
};
