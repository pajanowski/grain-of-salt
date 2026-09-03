import type { RequestHandler } from './$types';
import { forkRecipe } from '$lib/server/bo/recipesbo';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { DEMO_USER_ID } from '$lib/server/db/schema';

/**
 * POST /api/recipe/[id]/fork
 * Body: { "name": "New branch name" }
 *
 * Per ADR 0002, "fork" means chain extension: a new node is appended to
 * the chain containing `[id]` with `parentId = [id]` and empty change
 * arrays. The new node's materialized state is identical to the source's
 * until the user adds their own changes.
 *
 * The verb "fork" is retained in the UI for familiarity even though the
 * semantics is closer to a git branch than to a separate recipe.
 *
 * Ownership: the new node inherits its parent's ownerId (no cross-user
 * forking). The caller must own the source chain.
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

	// Verify the source node exists and the caller can see it (same
	// owner — guests can only fork their own demo tree).
	const rows = await db
		.select({ id: recipeNodes.id })
		.from(recipeNodes)
		.where(and(eq(recipeNodes.id, params.id), eq(recipeNodes.ownerId, ownerId)))
		.limit(1);

	if (rows.length === 0) {
		return new Response('Recipe not found', { status: 404 });
	}

	const sourceNodeId = rows[0].id;

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
		const newRecipe = await forkRecipe(sourceNodeId, ownerId, body.name.trim());
		return new Response(JSON.stringify(newRecipe), {
			status: 201,
			headers: { 'content-type': 'application/json' }
		});
	} catch (e) {
		return new Response((e as Error).message, { status: 500 });
	}
};
