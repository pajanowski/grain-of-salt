import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { extFromMime, nodeImagePath } from '$lib/server/storage/imagePaths';

/**
 * POST /api/recipe-node/[nodeId]/image
 *
 * Body: multipart/form-data with a single `file` field whose MIME is
 * one of the supported image types. The endpoint:
 *   1. Owner-checks the node.
 *   2. Uploads the file to recipe-images/{ownerId}/nodes/{nodeId}/final.{ext}.
 *   3. Updates the row's image_path column to the new storage path.
 *   4. Returns { imagePath: string }.
 *
 * The previous image (if any) is left in the bucket — orphan cleanup
 * is a separate concern (see recipe-images feature spec).
 *
 * Errors:
 *   401 unauthenticated
 *   403 not owner
 *   404 node not found
 *   400 invalid form data / unsupported MIME type
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) return new Response('Sign in first', { status: 401 });

	const nodeId = params.nodeId;
	if (!nodeId || nodeId.trim().length === 0) {
		return new Response('Node not found', { status: 404 });
	}

	// Owner-check before any work.
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

	const form = await request.formData().catch(() => null);
	if (!form) {
		return new Response('Invalid form data', { status: 400 });
	}
	const file = form.get('file');
	if (!(file instanceof File)) {
		return new Response('Missing file field', { status: 400 });
	}

	let ext;
	try {
		ext = extFromMime(file.type);
	} catch (e) {
		return new Response((e as Error).message, { status: 400 });
	}

	const path = nodeImagePath(ownerId, nodeId, ext);
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

	await db
		.update(recipeNodes)
		.set({ imagePath: path })
		.where(eq(recipeNodes.id, nodeId));

	return new Response(JSON.stringify({ imagePath: path }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};

/**
 * DELETE /api/recipe-node/[nodeId]/image
 *
 * Removes the storage object for the node-level "final dish" image
 * (if any) and nulls the column. Owner-checked like the POST path.
 *
 * Errors:
 *   401 unauthenticated
 *   403 not owner
 *   404 node not found
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) return new Response('Sign in first', { status: 401 });

	const nodeId = params.nodeId;
	if (!nodeId || nodeId.trim().length === 0) {
		return new Response('Node not found', { status: 404 });
	}

	const rows = await db
		.select({ ownerId: recipeNodes.ownerId, imagePath: recipeNodes.imagePath })
		.from(recipeNodes)
		.where(eq(recipeNodes.id, nodeId))
		.limit(1);
	if (rows.length === 0) {
		return new Response('Node not found', { status: 404 });
	}
	if (rows[0].ownerId !== ownerId) {
		return new Response('Forbidden', { status: 403 });
	}

	const existingPath = rows[0].imagePath;
	if (existingPath) {
		const { error: removeErr } = await locals.supabase.storage
			.from('recipe-images')
			.remove([existingPath]);
		if (removeErr) {
			// Log but don't fail — nulling the column is the source of truth.
			console.warn(`[image delete] storage.remove failed for ${existingPath}: ${removeErr.message}`);
		}
	}

	await db
		.update(recipeNodes)
		.set({ imagePath: null })
		.where(eq(recipeNodes.id, nodeId));

	return new Response(JSON.stringify({ imagePath: null }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};