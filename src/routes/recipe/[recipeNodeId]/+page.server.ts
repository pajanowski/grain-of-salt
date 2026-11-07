import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { applyNodes, isRecipeFavorited } from '$lib/server/bo/recipenodesbo';
import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
import type { SelectRecipeNode } from '$lib/server/db/schema';
import { SEED_NODES } from '$lib/demo-seed';

/**
 * Load a public recipe node by its UUID.
 */
export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	const recipeNodeId = params.recipeNodeId;
	const demoMode = Boolean((locals as any).demoMode);

	if (!recipeNodeId || recipeNodeId.trim().length === 0) {
		throw error(404, 'Recipe not found');
	}

	let history: RecipeNode[] = [];

	if (demoMode) {
		const seedMap = new Map(SEED_NODES.map((n) => [n.id, n]));
		const target = seedMap.get(recipeNodeId);
		if (target && target.isPublic) {
			const chain: RecipeNode[] = [];
			let cursor: RecipeNode | undefined = target;
			const visited = new Set<string>();
			while (cursor && !visited.has(cursor.id)) {
				visited.add(cursor.id);
				chain.push(cursor);
				if (!cursor.parentId) break;
				cursor = seedMap.get(cursor.parentId);
			}
			history = chain.reverse();
		}
	}

	if (history.length === 0) {
		// RLS-gated check that the starting node is public.
		const { data: startRow } = await locals.supabase
			.from('recipe_nodes')
			.select('id,is_public')
			.eq('id', recipeNodeId)
			.eq('is_public', true)
			.limit(1);

		if (!startRow || startRow.length === 0) {
			throw error(404, 'Recipe not found');
		}

		history = await walkChain(recipeNodeId, locals.supabase);
	}

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

	const viewerId = locals.user?.id ?? null;
	const isFavoritedByViewer =
		viewerId && !demoMode ? await isRecipeFavorited(viewerId, recipeNodeId) : current.isFavorite;

	if (!viewerId) {
		setHeaders({
			'cache-control': 'public, s-maxage=60, stale-while-revalidate=300'
		});
	} else {
		setHeaders({
			'cache-control': 'private, no-cache'
		});
	}

	return {
		recipe: {
			id: root.id,
			name: current.name,
			ingredients: state.ingredients,
			directions: state.directions
		},
		currentNode: {
			...current,
			isFavorite: isFavoritedByViewer
		},
		isSignedIn: Boolean(viewerId),
		history,
		parentChain
	};
};

type SupabaseClient = NonNullable<ReturnType<typeof import('$lib/server/supabase').createRequestClient>>;

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

	const rows = (data as SelectRecipeNode[]).slice().reverse();
	return rows.map(toUiRecipeNode);
}

function toUiRecipeNode(row: Record<string, unknown>): RecipeNode {
	return {
		id: row.id as string,
		name: row.name as string,
		parentId: (row.parentId ?? row.parent_id ?? null) as string | null,
		timestamp: row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp as string | number),
		ingredientChanges: (row.ingredientChanges ?? row.ingredient_changes ?? []) as RecipeNode['ingredientChanges'],
		directionChanges: (row.directionChanges ?? row.direction_changes ?? []) as RecipeNode['directionChanges'],
		author: (row.author ?? null) as string | null,
		source: (row.source ?? null) as string | null,
		isPublic: Boolean(row.isPublic ?? row.is_public),
		isFavorite: Boolean(row.isFavorite ?? row.is_favorite),
		imagePath: (row.imagePath ?? row.image_path ?? null) as string | null,
		description: (row.description ?? null) as string | null,
		note: (row.note ?? null) as string | null
	};
}
