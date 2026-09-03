import type { PageServerLoad } from './$types';
import { getRecipeNodesByRecipeIdV2, applyNodes } from '$lib/server/bo/recipenodesbo';
import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';

/**
 * The page URL is `/recipes/[slug]`, where `slug` is any recipe node id.
 *
 * We walk up the parentId chain to the root, then replay all nodes forward
 * (root → ... → current) to build the materialized recipe state. The
 * `parentChain` shows ancestor recipes for breadcrumb navigation.
 */
export const load: PageServerLoad = async ({ depends, params }) => {
  depends('app:recipe');
  const recipeNodeId = params.slug;

  // Fetch the chain from current node back to root.
  const chainBackwards = await getRecipeNodesByRecipeIdV2(recipeNodeId);

  // Reverse so we have root → ... → current (oldest first, needed for replay).
  const history = [...chainBackwards].reverse();

  if (history.length === 0) {
    throw new Error('Recipe not found');
  }

  // The root is the first element after reversing.
  const root = history[0];
  // The current node is the last element.
  const current = history[history.length - 1];

  // Materialize the full recipe state by replaying all nodes.
  const state = applyNodes(history);

  // Build the parent breadcrumb chain: ancestor recipes (not including self).
  // Skip the first entry (root) — we don't include the recipe itself in the chain.
  // Then skip the last entry (current) — that's the page we're on.
  const parentChain = history
    .slice(1) // drop root
    .slice(0, -1) // drop current
    .map((node: RecipeNode) => ({ id: node.id, name: node.name }));

  return {
		recipe: {
			// Recipe identity is the root node, not the node currently being
			// viewed/edited. save/rename APIs walk the chain forward from
			// this id via `parentId`, so it must be the root.
			id: root.id,
			name: current.name,
			ingredients: state.ingredients,
			directions: state.directions,
		},
    history, // full node chain for the history UI
    parentChain,
  };
};
