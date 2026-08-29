import type { RequestHandler } from './$types';
import { deleteRecipe, renameRecipe } from '$lib/server/bo/recipesbo';
import { DEMO_USER_ID } from '$lib/server/db/schema';

/**
 * Resolve ownerId from the session or guest cookie. Guest requests can
 * rename/delete demo recipes (owned by DEMO_USER_ID), but cannot touch
 * anyone else's tree.
 */
function resolveOwnerId(
	locals: App.Locals,
	cookies: { get: (name: string) => string | undefined }
): string | null {
	if (locals.user?.id) return locals.user.id;
	if (cookies.get('guest') === '1') return DEMO_USER_ID;
	return null;
}

export const DELETE: RequestHandler = async ({ params, locals, cookies }) => {
	if (!params.id || params.id.trim().length === 0) {
		return new Response('Recipe not found', { status: 404 });
	}

	const ownerId = resolveOwnerId(locals, cookies);
	if (!ownerId) {
		return new Response('Sign in or continue as guest first', { status: 401 });
	}

	try {
		await deleteRecipe(params.id, ownerId);
		return new Response(null, { status: 200 });
	} catch (e) {
		return new Response((e as Error).message, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ params, request, locals, cookies }) => {
	if (!params.id || params.id.trim().length === 0) {
		return new Response('Recipe not found', { status: 404 });
	}

	const ownerId = resolveOwnerId(locals, cookies);
	if (!ownerId) {
		return new Response('Sign in or continue as guest first', { status: 401 });
	}

	let body: { name?: unknown };
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	if (typeof body.name !== 'string' || body.name.trim().length === 0) {
		return new Response('Name is required', { status: 400 });
	}

	try {
		await renameRecipe(params.id, ownerId, body.name);
		return new Response(JSON.stringify({ name: body.name.trim() }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	} catch (e) {
		return new Response((e as Error).message, { status: 500 });
	}
};
