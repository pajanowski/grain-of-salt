import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard';
import {
	getRecipeNodesByRecipeIdV2,
	applyNodes,
	findDescendantSubstitutes
} from '$lib/server/bo/recipenodesbo';
import type { DescendantSubstitutes } from '$lib/server/bo/recipenodesbo';
import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
import { SEED_NODES } from '$lib/demo-seed';

/**
 * The page URL is `/recipes/[slug]`, where `slug` is any recipe node id.
 *
 * We walk up the parentId chain to the root, then replay all nodes forward
 * (root → ... → current) to build the materialized recipe state. The
 * `parentChain` shows ancestor recipes for breadcrumb navigation.
 */
export const load: PageServerLoad = async (event) => {
	event.depends('app:recipe');
	const user = await requireUser(event);
	const recipeNodeId = event.params.slug;
	const demoMode = Boolean((event.locals as any).demoMode);

	// Fetch the chain from current node back to root.
	let chainBackwards = await getRecipeNodesByRecipeIdV2(recipeNodeId);

	if (chainBackwards.length === 0 && demoMode) {
		const seedMap = new Map(SEED_NODES.map((n) => [n.id, n]));
		let cursor = seedMap.get(recipeNodeId);
		const visited = new Set<string>();
		while (cursor && !visited.has(cursor.id)) {
			visited.add(cursor.id);
			chainBackwards.push(cursor);
			if (!cursor.parentId) break;
			cursor = seedMap.get(cursor.parentId);
		}
	}

	// Reverse so we have root → ... → current (oldest first, needed for replay).
	const history = [...chainBackwards].reverse();

	if (history.length === 0) {
		if (demoMode) {
			return {
				recipe: {
					id: recipeNodeId,
					name: 'Recipe',
					ingredients: [],
					directions: []
				},
				currentNode: {
					id: recipeNodeId,
					name: 'Recipe',
					parentId: null,
					timestamp: new Date(),
					author: 'Demo User',
					source: null,
					isPublic: false,
					isFavorite: false,
					imagePath: null,
					ingredientChanges: [],
					directionChanges: []
				},
				history: [],
				parentChain: [],
				descendantSubstitutes: { flat: [], byRowId: {}, byRowKind: {} },
				inheritedImages: { ingredients: {}, directions: {} }
			};
		}
		throw error(404, 'Recipe not found');
	}

	// The root is the first element after reversing.
	const root = history[0];
	// The current node is the last element.
	const current = history[history.length - 1];

	// Materialize the full recipe state by replaying all nodes.
	const state = applyNodes(history);
	const inheritedState = state;

	// Build the parent breadcrumb chain: ancestor recipes (not including self).
	const parentChain = history
		.slice(1) // drop root
		.slice(0, -1) // drop current
		.map((node: RecipeNode) => ({ id: node.id, name: node.name }));

	const ownerId = user?.id ?? null;
	const descendantSubstitutes: DescendantSubstitutes =
		ownerId && !demoMode
			? await findDescendantSubstitutes(current.id, ownerId)
			: { flat: [], byRowId: {}, byRowKind: {} };

	return {
		recipe: {
			id: root.id,
			name: current.name,
			ingredients: state.ingredients,
			directions: state.directions
		},
		currentNode: { ...current, author: current.author, source: current.source },
		history,
		parentChain,
		descendantSubstitutes,
		inheritedImages: {
			ingredients: Object.fromEntries(
				inheritedState.ingredients
					.filter((i) => i.imagePaths && i.imagePaths.length > 0)
					.map((i) => [i.id, i.imagePaths as string[]])
			),
			directions: Object.fromEntries(
				inheritedState.directions
					.filter((d) => d.imagePaths && d.imagePaths.length > 0)
					.map((d) => [d.id, d.imagePaths as string[]])
			)
		}
	};
};
