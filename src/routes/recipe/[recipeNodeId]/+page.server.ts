import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { applyNodes } from '$lib/server/bo/recipenodesbo';
import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
import type { SelectRecipeNode } from '$lib/server/db/schema';

/**
 * Load a public recipe node by its UUID.
 *
 * Uses event.locals.supabase (the per-request Supabase client) so that RLS
 * policies are enforced at every step of the chain walk. The anon-key client
 * used for unauthenticated requests only sees rows where is_public = true
 * via policy `recipe_nodes_select_public`.
 *
 * If the starting node is absent or private → history is empty → throw 404.
 *
 * Cache headers ensure shared links don't hammer the DB.
 */
export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	const recipeNodeId = params.recipeNodeId;

	if (!recipeNodeId || recipeNodeId.trim().length === 0) {
		throw error(404, 'Recipe not found');
	}

	// Walk the chain using the per-request Supabase client.
	// This respects RLS in both local dev (Supabase API → Postgres) and
	// in Supabase Cloud (connection pooler enforces RLS on the anon JWT).
	//
	// Use the Supabase client for the starting-node check (respects RLS via
	// request.jwt_role = 'anon' in Supabase local, and via the connection
	// pooler in Supabase Cloud). Skip if not public → 404.
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
 * Walk the parent_id chain using the per-request Supabase client.
 * RLS is enforced on every step: a private node (or non-existent ID)
 * returns zero rows and the walk stops. Returns oldest-first (root → current).
 */
async function walkChain(
	startId: string,
	supabase: SupabaseClient
): Promise<RecipeNode[]> {
	const chain: RecipeNode[] = [];
	let currentId: string | null = startId;

	while (currentId) {
		// This SELECT is gated by RLS policy `recipe_nodes_select_public`.
		// Anon callers only see rows where is_public = true.
		const { data, error: err } = await supabase
			.from('recipe_nodes')
			.select('*')
			.eq('id', currentId)
			.limit(1);

		if (err || !data || data.length === 0) {
			break;
		}

		const row = data[0] as SelectRecipeNode;
		// Supabase JS client returns raw Postgres column names (snake_case).
		// .select('*') gives is_public, not isPublic.
		if (!row.is_public) {
			break;
		}

		chain.push(toUiRecipeNode(row));
		currentId = row.parentId;
	}

	return chain;
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
