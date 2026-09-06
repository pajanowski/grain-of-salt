import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getRecipeNodesByRecipeIdV2, applyNodes } from '$lib/server/bo/recipenodesbo';
import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
import { demoRecipes, demoNodes } from '$lib/recipe-store.demo';
import { get } from 'svelte/store';

/**
 * The page URL is `/recipes/[slug]`, where `slug` is any recipe node id.
 *
 * We walk up the parentId chain to the root, then replay all nodes forward
 * (root → ... → current) to build the materialized recipe state. The
 * `parentChain` shows ancestor recipes for breadcrumb navigation.
 */
export const load: PageServerLoad = async ({ depends, params, locals }) => {
	depends('app:recipe');
	const recipeNodeId = params.slug;

	// Demo mode: use the server-side demo store (seeded at module eval time).
	if (locals.demoMode) {
		const recipes = get(demoRecipes);
		const nodes = get(demoNodes);

		if (!recipes.length || !nodes.size) throw error(404, 'Recipe not found');

		// Map node id -> recipe id so we can resolve a child node to its root.
		const recipeIdByNodeId = new Map<string, string>();
		for (const n of nodes.values()) recipeIdByNodeId.set(n.id, n.recipeId);

		// Resolve: nodeId might be a recipe id (root) or a child node id.
		let recipeId = recipeNodeId;
		if (!recipes.find((r) => r.id === recipeId)) {
			recipeId = recipeIdByNodeId.get(recipeNodeId) ?? '';
		}
		if (!recipeId) throw error(404, 'Recipe not found');

		const summary = recipes.find((r) => r.id === recipeId);
		if (!summary) throw error(404, 'Recipe not found');

		// Build ordered node chain: root → ... → current (demo nodes are flat).
		const chain: RecipeNode[] = [];
		let currentId: string | null = recipeId;
		while (currentId) {
			const node = nodes.get(currentId);
			if (!node) break;
			chain.push(node as unknown as RecipeNode);
			currentId = node.parentId;
		}
		if (!chain.length) throw error(404, 'Recipe not found');

		// Apply node changes to materialize ingredients/directions.
		const state = applyNodes(chain);
		const current = chain[chain.length - 1];
		const parentChain = chain.slice(0, -1).map((n) => ({ id: n.id, name: n.name }));

		return {
			recipe: { id: summary.id, name: current.name, ingredients: state.ingredients, directions: state.directions },
			currentNode: current,
			history: chain,
			parentChain
		};
	}

	// Production: fetch the chain from current node back to root.
	const chainBackwards = await getRecipeNodesByRecipeIdV2(recipeNodeId);
	const history = [...chainBackwards].reverse();

	if (history.length === 0) throw error(404, 'Recipe not found');

	const root = history[0];
	const current = history[history.length - 1];
	const state = applyNodes(history);
	const parentChain = history.slice(1, -1).map((node: RecipeNode) => ({ id: node.id, name: node.name }));

	return {
		recipe: { id: root.id, name: current.name, ingredients: state.ingredients, directions: state.directions },
		currentNode: current,
		history,
		parentChain
	};
};
