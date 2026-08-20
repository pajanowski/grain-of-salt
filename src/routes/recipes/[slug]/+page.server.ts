import type { PageServerLoad } from './$types';
import { getRecipeState, getRecipeNodesByRecipeId, getRootRecipeNode } from '$lib/server/bo/recipenodesbo';
import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';

/**
 * The page URL is `/recipes/[slug]`, where `slug` is the ROOT NODE id of a
 * recipe. We resolve that root, fetch the materialized state, and load the
 * full chain for the history view.
 *
 * If `slug` is the id of any node in a recipe (not just the root), we
 * still navigate "up" to the root of that recipe so the user lands on the
 * recipe page. (Handy if someone shares a deep link to a non-root node.)
 */
async function resolveParentChain(root: RecipeNode): Promise<Array<{ id: string; name: string }>> {
  // Walk up via parentNodeId: root -> parent's chain node -> that node's
  // chain's root -> that root's parentNodeId -> ...
  const chain: Array<{ id: string; name: string }> = [];
  let currentRoot: RecipeNode = root;
  const visited = new Set<string>();
  while (currentRoot.parentNodeId) {
    if (visited.has(currentRoot.parentNodeId)) break; // cycle guard
    visited.add(currentRoot.parentNodeId);
    const parentRoot = await getRootRecipeNode(currentRoot.parentNodeId);
    if (!parentRoot) break;
    chain.unshift({ id: parentRoot.id, name: parentRoot.name });
    currentRoot = parentRoot;
  }
  return chain;
}

export const load: PageServerLoad = async ({ depends, params }) => {
  try {
    depends('app:recipe');
    const root = await getRootRecipeNode(params.slug);
    if (!root) {
      throw new Error('Recipe not found');
    }

    const [state, history, parentChain] = await Promise.all([
      getRecipeState(root.id),
      getRecipeNodesByRecipeId(root.id),
      resolveParentChain(root),
    ]);

    return {
      recipe: {
        id: root.id,
        name: root.name,
        ingredients: state.ingredients,
        directions: state.directions,
      },
      history,
      parentChain,
    };
  } catch (err) {
    console.error('[Recipe slug load error]', err);
    throw err;
  }
};
