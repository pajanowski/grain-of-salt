import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	changeImagePath,
	extFromMime,
	assertPathUnderOwner
} from '$lib/server/storage/imagePaths';

/**
 * POST /api/recipe-node/[nodeId]/change/[changeId]/image?kind=ingredient|direction
 *
 * Body: multipart/form-data with a single `file` field whose MIME is
 * one of the supported image types.
 *
 * The `changeId` is the uuid the form layer minted up-front (see
 * `addIngredient` / `addDirection` in Recipe.svelte). The upload
 * endpoint writes to `recipe-images/{ownerId}/{ingredients|directions}/{changeId}.{ext}`
 * so the change record's `imagePaths` array can reference it directly
 * once the change is saved.
 *
 * Owner-checked via the parent node's `ownerId` — a user can't upload
 * to someone else's recipe by guessing a changeId.
 *
 * Errors:
 *   401 unauthenticated
 *   403 not owner
 *   404 node not found
 *   400 invalid form data / unsupported MIME / invalid `kind`
 *   400 changeId doesn't match a uuid shape (defensive — prevents
 *     path injection)
 */
export const POST: RequestHandler = async ({ params, request, url, locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) return new Response('Sign in first', { status: 401 });

	const nodeId = params.nodeId;
	const changeId = params.changeId;
	if (!nodeId || !changeId) return new Response('Bad request', { status: 400 });

	const kindRaw = url.searchParams.get('kind');
	if (kindRaw !== 'ingredient' && kindRaw !== 'direction') {
		return new Response('Invalid kind (expected ingredient or direction)', {
			status: 400
		});
	}
	const kind = kindRaw;

	// Defensive uuid shape check — changeId is a uuid the client
	// minted up-front. Without this, a hand-crafted path segment could
	// inject '/', '..', or other path-traversal characters into the
	// storage key.
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(changeId)) {
		return new Response('Invalid changeId format', { status: 400 });
	}

	// Owner-check the parent node before any work.
	const rows = await db
		.select({ ownerId: recipeNodes.ownerId })
		.from(recipeNodes)
		.where(eq(recipeNodes.id, nodeId))
		.limit(1);
	if (rows.length === 0) return new Response('Node not found', { status: 404 });
	if (rows[0].ownerId !== ownerId) return new Response('Forbidden', { status: 403 });

	const form = await request.formData().catch(() => null);
	if (!form) return new Response('Invalid form data', { status: 400 });
	const file = form.get('file');
	if (!(file instanceof File)) return new Response('Missing file field', { status: 400 });

	let ext;
	try {
		ext = extFromMime(file.type);
	} catch (e) {
		return new Response((e as Error).message, { status: 400 });
	}

	const path = changeImagePath(ownerId, kind, changeId, ext);

	// Defense-in-depth: re-verify the constructed path is rooted under
	// ownerId. Should always be true given the inputs above, but the
	// trust boundary lives here.
	assertPathUnderOwner(path, ownerId);

	const arrayBuffer = await file.arrayBuffer();
	const { error: uploadErr } = await locals.supabase.storage
		.from('recipe-images')
		.upload(path, arrayBuffer, {
			contentType: file.type,
			upsert: true
		});
	if (uploadErr) {
		return new Response(`Upload failed: ${uploadErr.message}`, { status: 500 });
	}

	return new Response(JSON.stringify({ path }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};