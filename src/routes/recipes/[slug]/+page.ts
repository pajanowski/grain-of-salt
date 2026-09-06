import type { PageLoad } from './$types';
import { isDemoMode } from '$lib/demo-init';
import type { RecipeNode, IngredientChange, DirectionChange } from '$lib/obj/RecipeNode.svelte';
import type { RecipeSummary } from '$lib/recipe-store';

/**
 * Recipe detail page — demo mode (universal load).
 *
 * During client-side navigation to /recipes/[slug], the +page.server.ts load
 * can't access the browser's demo store (which holds newly created recipes).
 * This universal load runs in the browser and reads from the demo store.
 * SSR: the server-side page.server.ts handles everything; this file only
 * affects client-side navigation.
 */
export const load: PageLoad = async ({ params, data }) => {
	// If production data came back from the server, use it.
	if (data.recipe) return data;

	// Demo mode: the server returned nothing. Guard with typeof window to
	// prevent SSR from trying to access browser-only globals.
	const demoMode =
		typeof window !== 'undefined' && isDemoMode(window, import.meta.env.VITE_DEMO_MODE);
	if (demoMode) {
		const { demoRecipes, demoNodes } = await import('$lib/recipe-store.demo');
		const { get } = await import('svelte/store');

		const recipes = get(demoRecipes) as RecipeSummary[];
		const nodes = get(demoNodes) as Map<
			string,
			{
				id: string;
				recipeId: string;
				parentId: string | null;
				name: string;
				label: string | null;
				timestamp: Date;
				ingredientChanges: IngredientChange[];
				directionChanges: DirectionChange[];
			}
		>;

		// Map node id -> recipe id.
		const recipeIdByNodeId = new Map<string, string>();
		for (const n of nodes.values()) recipeIdByNodeId.set(n.id, n.recipeId);

		// Resolve recipeId from nodeId (slug might be recipe id or node id).
		let recipeId = params.slug;
		if (!recipes.find((r) => r.id === recipeId)) {
			recipeId = recipeIdByNodeId.get(params.slug) ?? '';
		}

		const summary = recipes.find((r) => r.id === recipeId);
		if (!summary) throw new Error(`Demo recipe not found: ${params.slug}`);

		// Build ordered node chain: root → ... → leaf.
		const chain: RecipeNode[] = [];
		let currentId: string | null = recipeId;
		while (currentId) {
			const node = nodes.get(currentId);
			if (!node) break;
			chain.push({
				id: node.id,
				name: node.name,
				parentId: node.parentId,
				label: node.label,
				timestamp: node.timestamp,
				ingredientChanges: node.ingredientChanges,
				directionChanges: node.directionChanges
			});
			currentId = node.parentId;
		}
		if (!chain.length) throw new Error(`Demo recipe chain not found: ${params.slug}`);

		// Materialize the recipe state by replaying all node changes (same as applyNodes).
		const state = applyNodes(chain);
		const current = chain[chain.length - 1];
		const parentChain = chain.slice(0, -1).map((n) => ({ id: n.id, name: n.name }));

		return {
			recipe: {
				id: summary.id,
				name: current.name,
				ingredients: state.ingredients,
				directions: state.directions
			},
			currentNode: current,
			history: chain,
			parentChain
		};
	}

	return data;
};

/** Inline applyNodes logic — replays all ingredient/direction changes from root to leaf. */
function applyNodes(nodes: RecipeNode[]): { ingredients: unknown[]; directions: unknown[] } {
	let ingredients: unknown[] = [];
	let directions: unknown[] = [];

	for (const node of nodes) {
		for (const change of node.ingredientChanges) {
			if (change.changeType === 'add') {
				ingredients = ingredients.filter((i: unknown) => (i as { id: string }).id !== change.body.id);
				ingredients = [...ingredients, change.body];
			} else if (change.changeType === 'remove') {
				ingredients = ingredients.filter((i: unknown) => (i as { id: string }).id !== change.targetId);
			}
		}

		for (const change of node.directionChanges) {
			if (change.changeType === 'add') {
				directions = directions.filter((d: unknown) => (d as { id: string }).id !== change.body.id);
				directions = [...directions, change.body];
			} else if (change.changeType === 'remove') {
				directions = directions.filter((d: unknown) => (d as { id: string }).id !== change.targetId);
			}
		}
	}

	return { ingredients, directions };
}
