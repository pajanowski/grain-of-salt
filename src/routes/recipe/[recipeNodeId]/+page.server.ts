import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { applyNodes } from '$lib/server/bo/recipenodesbo';
import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
import type { SelectRecipeNode } from '$lib/server/db/schema';

/**
 * Load a public recipe node by its UUID.
 *
 * Uses event.locals.supabase for the starting-node RLS check so anon
 * callers 404 immediately when the requested node isn't public. The full
 * parent chain is then walked with the `get_recipe_chain` SQL function
 * (security definer, anon-granted) because the public page must render
 * the *compiled* recipe — every ancestor's ingredients and directions —
 * even when some of those ancestors are themselves private. RLS alone
 * would stop the walk at the first private ancestor and silently drop
 * its content.
 *
 * If the starting node is absent or private → throw 404.
 *
 * Cache headers ensure shared links don't hammer the DB.
 */
export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	const recipeNodeId = params.recipeNodeId;

	if (!recipeNodeId || recipeNodeId.trim().length === 0) {
		throw error(404, 'Recipe not found');
	}

	// RLS-gated check that the starting node is public. Without this, an
	// anon caller could probe whether a private node id exists by
	// comparing the compiled response against a 404. The full chain is
	// fetched separately via the security-definer RPC.
	const { data: startRow } = await locals.supabase
		.from('recipe_nodes')
		.select('id,is_public')
		.eq('id', recipeNodeId)
		.eq('is_public', true)
		.limit(1);

	if (!startRow || startRow.length === 0) {
		throw error(404, 'Recipe not found');
	}

	const history = await walkChain(recipeNodeId, locals.supabase);

	if (history.length === 0) {
		throw error(404, 'Recipe not found');
	}

	const root = history[0];
	const current = history[history.length - 1];

	// Materialize the full recipe state.
	const state = applyNodes(history);

	const parentChain = history
		.slice(1)
		.slice(0, -1)
		.map((node: RecipeNode) => ({ id: node.id, name: node.name }));

	setHeaders({
		'cache-control': 'public, s-maxage=60, stale-while-revalidate=300'
	});

	return {
		recipe: {
			id: root.id,
			name: current.name,
			ingredients: state.ingredients,
			directions: state.directions
		},
		currentNode: { ...current },
		history,
		parentChain
	};
};

type SupabaseClient = NonNullable<ReturnType<typeof import('$lib/server/supabase').createRequestClient>>;

/**
 * Walk the parent_id chain via the `get_recipe_chain` RPC.
 *
 * The RPC is security-definer and anon-granted (see migration
 * 20260909100000_public_recipe.sql), so it returns ancestors regardless
 * of their own is_public flag. That is intentional: a user who marks a
 * descendant node public expects the public page to render the full
 * compiled recipe — not just the descendant's own deltas. The starting
 * node's public-ness is already enforced by the RLS-gated SELECT above
 * before this walk runs.
 *
 * Returns oldest-first (root → current).
 */
async function walkChain(
	startId: string,
	supabase: SupabaseClient
): Promise<RecipeNode[]> {
	const { data, error: err } = await supabase.rpc('get_recipe_chain', {
		start_id: startId
	});

	if (err) {
		throw error(500, 'Failed to load recipe chain');
	}
	if (!data || data.length === 0) {
		return [];
	}

	// The RPC returns rows leaf-first (depth 0 = start node, increasing
	// depth = walking up the parent chain). Replay needs oldest-first
	// (root → current), so reverse before mapping.
	const rows = (data as SelectRecipeNode[]).slice().reverse();
	return rows.map(toUiRecipeNode);
}

function toUiRecipeNode(row: SelectRecipeNode): RecipeNode {
	return {
		id: row.id,
		name: row.name,
		parentId: row.parent_id,
		timestamp: row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp),
		ingredientChanges: row.ingredient_changes as RecipeNode['ingredientChanges'],
		directionChanges: row.direction_changes as RecipeNode['directionChanges'],
		author: row.author ?? null,
		source: row.source ?? null,
		isPublic: row.is_public
	};
}
