import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createServiceClient } from '$lib/server/supabase';

/**
 * GET /mise/api/image?path=<storage-path>
 *
 * Mints a short-lived signed URL for a recipe image and 302-redirects
 * the browser to it. The browser's `<img src="/mise/api/image?path=...">`
 * follows the redirect transparently.
 *
 * Two access paths:
 *
 *   1. Owner — the path's first folder segment matches the
 *      authenticated user's id. Verified directly via locals.user.id.
 *
 *   2. Public recipe visitor — the path is referenced by a
 *      recipe_nodes row whose `is_public = true`. Verified by
 *      matching the path against the public node's image_path (for
 *      final-dish images) OR by joining change records (for
 *      ingredient/direction images). The latter is the common case.
 *
 * Path safety: every storage path under this bucket begins with
 * `{ownerId}/`. We strip that segment, look up which node it belongs
 * to, then check the OWNER's is_public state. If public, any visitor
 * can render; if private, only the owner.
 *
 * For per-change paths (`{ownerId}/ingredients/{changeId}.{ext}` or
 * `{ownerId}/directions/{changeId}.{ext}`), the changeId alone tells
 * us which node owns it — change records carry the recipe_node_id.
 *
 * Errors:
 *   400 missing path
 *   403 not the owner and the owning recipe is private
 *   404 no matching record for the path
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const path = url.searchParams.get('path');
	if (!path || path.trim().length === 0) {
		throw error(400, 'Missing path');
	}

	// Sanity: path must be bucket-shaped (no leading slash, must
	// contain at least owner/leaf).
	const parts = path.split('/');
	if (parts.length < 2 || parts[0].length === 0) {
		throw error(400, 'Malformed path');
	}
	const ownerId = parts[0];

	// Public-recipe gate: is the owning recipe public? If so, anyone
	// can render. For per-change paths we look up which node owns the
	// change record. For per-version paths, the path itself encodes
	// the node id (`nodes/{nodeId}/final.{ext}`).
	const isPublic = await isPathPublic(path, ownerId);
	if (!isPublic) {
		// Private — owner-only.
		if (!locals.user || locals.user.id !== ownerId) {
			throw error(403, 'Forbidden');
		}
	}

	const svc = createServiceClient();
	const { data, error: signErr } = await svc.storage
		.from('recipe-images')
		.createSignedUrl(path, 300); // 5 minutes
	if (signErr || !data) {
		throw error(500, `Failed to sign URL: ${signErr?.message ?? 'unknown'}`);
	}

	// 302 redirect — short-lived, browser caches per the URL.
	return new Response(null, {
		status: 302,
		headers: {
			location: data.signedUrl,
			'cache-control': 'private, max-age=120'
		}
	});
};

/**
 * Returns true if the path belongs to a public-recipe node. Owner
 * folders that don't resolve to any visible node return false.
 *
 * For per-version paths (`nodes/{nodeId}/final.{ext}`) we look up the
 * node's is_public flag directly.
 *
 * For per-change paths (`ingredients/{changeId}.{ext}` or
 * `directions/{changeId}.{ext}`) we look up the change record's
 * parent node's is_public flag. Note: a change can belong to any
 * ancestor in the chain — for the public-render case, the public
 * flag must be true on the leaf that the public page is rendering
 * for. The simplest correct check is to look up the change's
 * immediate parent node and check that node's is_public — this
 * handles the common "public recipe has change records" case.
 *
 * For deep ancestor paths (a per-change image attached to an
 * ancestor of a public descendant), the public page already has
 * the leaf's is_public, so the descendant's RLS-visible ancestors
 * suffice for the public render. The check below only confirms
 * the change record resolves to ANY node the visitor can see — if
 * the visitor is the public page and the path belongs to a
 * non-public ancestor's change record, the public page won't render
 * it (the materialized state for a public descendant includes only
 * the public-visible ancestors). Good enough for v1.
 */
async function isPathPublic(path: string, ownerId: string): Promise<boolean> {
	const parts = path.split('/');
	if (parts.length < 3) return false;

	// Per-version: {ownerId}/nodes/{nodeId}/final.{ext}
	if (parts[1] === 'nodes') {
		const nodeId = parts[2];
		const rows = await db
			.select({ isPublic: recipeNodes.isPublic })
			.from(recipeNodes)
			.where(eq(recipeNodes.id, nodeId))
			.limit(1);
		return rows.length > 0 && rows[0].isPublic === true;
	}

	// Per-change: {ownerId}/ingredients/{changeId}.{ext}
	//              {ownerId}/directions/{changeId}.{ext}
	if (parts[1] === 'ingredients' || parts[1] === 'directions') {
		const changeId = parts[2].split('.')[0]; // strip extension
		// Look up the change record's parent node id. The change
		// records are stored on the recipe_nodes row's
		// ingredient_changes / direction_changes jsonb arrays, so
		// we have to read those out. For a v1 simplification, we
		// query all the user's nodes (one read of recipe_nodes
		// filtered by ownerId) and search the change arrays in
		// memory. This is bounded by the user's node count and
		// fits the existing per-user load patterns.
		const userNodes = await db
			.select({
				id: recipeNodes.id,
				isPublic: recipeNodes.isPublic,
				ingredientChanges: recipeNodes.ingredientChanges,
				directionChanges: recipeNodes.directionChanges
			})
			.from(recipeNodes)
			.where(eq(recipeNodes.ownerId, ownerId));
		for (const n of userNodes) {
			const ing = (n.ingredientChanges ?? []) as Array<{ id?: string }>;
			const dir = (n.directionChanges ?? []) as Array<{ id?: string }>;
			if (ing.some((c) => c?.id === changeId)) return n.isPublic === true;
			if (dir.some((c) => c?.id === changeId)) return n.isPublic === true;
		}
		return false;
	}

	return false;
}