import type { RequestHandler } from './$types';
import { deleteRecipe, renameRecipe } from '$lib/server/bo/recipesbo';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) {
		return new Response('Sign in first', { status: 401 });
	}

	if (!params.id || params.id.trim().length === 0) {
		return new Response('Recipe not found', { status: 404 });
	}

	try {
		await deleteRecipe(params.id, ownerId);
		return new Response(null, { status: 200 });
	} catch (e) {
		return new Response((e as Error).message, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) {
		return new Response('Sign in first', { status: 401 });
	}

	if (!params.id || params.id.trim().length === 0) {
		return new Response('Recipe not found', { status: 404 });
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
