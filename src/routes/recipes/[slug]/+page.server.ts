import type { PageServerLoad } from './$types';
import { getRecipeState, getRecipeNodesByRecipeId } from '$lib/server/bo/recipenodesbo';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { IngredientChange, DirectionChange, RecipeNode } from '$lib/obj/RecipeNode.svelte';

type DbRecipeNode = typeof recipeNodes.$inferSelect;

function toUiRecipeNode(row: DbRecipeNode): RecipeNode {
  return {
    id: row.id,
    recipeId: row.recipeId,
    name: row.name,
    parentId: row.parentId,
    parentNodeId: row.parentNodeId,
    label: row.label,
    timestamp: row.timestamp instanceof Date ? row.timestamp.getTime() : Number(row.timestamp),
    ingredientChanges: (row.ingredientChanges ?? []) as IngredientChange[],
    directionChanges: (row.directionChanges ?? []) as DirectionChange[],
  };
}

/**
 * The page URL is `/recipes/[slug]`, where `slug` is the ROOT NODE id of a
 * recipe. We resolve that root to its recipeId, fetch the materialized
 * state, and load the full chain for the history view.
 *
 * If `slug` is the id of any node in a recipe (not just the root), we
 * still navigate "up" to the root of that recipe so the user lands on the
 * recipe page. (Handy if someone shares a deep link to a non-root node.)
 */
async function resolveRoot(slug: string): Promise<RecipeNode | null> {
  // First: try slug as a root node id.
  const direct = await db
    .select()
    .from(recipeNodes)
    .where(eq(recipeNodes.id, slug))
    .limit(1);
  const row = direct[0];
  if (!row) return null;
  let node = toUiRecipeNode(row);

  // Walk back via parentId until we reach a root (parentId is null).
  if (node.parentId === null) return node;

  // Otherwise walk up.
  let cursor: RecipeNode | undefined = node;
  const visited = new Set<string>();
  while (cursor && cursor.parentId !== null) {
    if (visited.has(cursor.parentId)) break; // cycle guard
    visited.add(cursor.parentId);
    const parentRows = await db
      .select()
      .from(recipeNodes)
      .where(eq(recipeNodes.id, cursor.parentId))
      .limit(1);
    if (!parentRows[0]) break;
    cursor = toUiRecipeNode(parentRows[0]);
  }
  return cursor ?? null;
}

async function resolveParentChain(root: RecipeNode): Promise<Array<{ id: string; name: string }>> {
  // Walk up via parentNodeId: root -> parent's tail -> that root's parentNodeId -> ...
  const chain: Array<{ id: string; name: string }> = [];
  let current: RecipeNode = root;
  const visited = new Set<string>();
  while (current.parentNodeId) {
    if (visited.has(current.parentNodeId)) break; // cycle guard
    visited.add(current.parentNodeId);
    const parentRows = await db
      .select()
      .from(recipeNodes)
      .where(eq(recipeNodes.id, current.parentNodeId))
      .limit(1);
    const parentRow = parentRows[0];
    if (!parentRow) break;
    const parent = toUiRecipeNode(parentRow);
    chain.unshift({ id: parent.id, name: parent.name });
    // Now find the root of the parent recipe (the node whose parentId is null
    // within the parent's chain). The parent node we just fetched is the
    // tail of the parent recipe.
    let cursor: RecipeNode | undefined = parent;
    while (cursor && cursor.parentId !== null) {
      const prevRows = await db
        .select()
        .from(recipeNodes)
        .where(eq(recipeNodes.id, cursor.parentId))
        .limit(1);
      if (!prevRows[0]) break;
      cursor = toUiRecipeNode(prevRows[0]);
    }
    if (!cursor) break;
    current = cursor;
  }
  return chain;
}

export const load: PageServerLoad = async ({ params }) => {
  const root = await resolveRoot(params.slug);
  if (!root) {
    throw new Error('Recipe not found');
  }

  const [state, history, parentChain] = await Promise.all([
    getRecipeState(root.recipeId),
    getRecipeNodesByRecipeId(root.recipeId),
    resolveParentChain(root),
  ]);

  return {
    recipe: {
      id: root.id,
      recipeId: root.recipeId,
      name: root.name,
      ingredients: state.ingredients,
      directions: state.directions,
    },
    history,
    parentChain,
  };
};
