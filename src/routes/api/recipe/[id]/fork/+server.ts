import type { RequestHandler } from './$types';
import { forkRecipe } from '$lib/server/bo/recipesbo';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { DEMO_USER_ID } from '$lib/server/db/schema';

/**
 * POST /api/recipe/[id]/fork
 * Body: { "name": "New Recipe Name" }
 *
 * The new recipe is owned by the caller (real user or guest's DEMO_USER_ID).
 * Guests can fork demo recipes; forking a real user's recipe while signed
 * out is blocked because the source recipe wouldn't be visible to them
 * anyway.
 */
function resolveOwnerId(
	locals: App.Locals,
	cookies: { get: (name: string) => string | undefined }
): string | null {
	if (locals.user?.id) return locals.user.id;
	if (cookies.get('guest') === '1') return DEMO_USER_ID;
	return null;
}

export const POST: RequestHandler = async ({ params, request, locals, cookies }) => {
	const ownerId = resolveOwnerId(locals, cookies);
	if (!ownerId) {
		return new Response('Sign in or continue as guest first', { status: 401 });
	}

	// Verify the source recipe exists and the caller can see it (same
	// owner — guests can only fork their own demo tree).
	const rows = await db
		.select({ id: recipeNodes.id })
		.from(recipeNodes)
		.where(and(eq(recipeNodes.id, params.id), eq(recipeNodes.ownerId, ownerId)))
		.limit(1);

	if (rows.length === 0) {
		return new Response('Recipe not found', { status: 404 });
	}

	const sourceRootNodeId = rows[0].id;

	let body: { name?: unknown };
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}

	if (typeof body.name !== 'string' || body.name.trim().length === 0) {
		return new Response('name is required', { status: 400 });
	}

	try {
		const newRecipe = await forkRecipe(sourceRootNodeId, ownerId, body.name.trim());
		return new Response(JSON.stringify(newRecipe), {
			status: 201,
			headers: { 'content-type': 'application/json' }
		});
	} catch (e) {
		return new Response((e as Error).message, { status: 500 });
	}
};
