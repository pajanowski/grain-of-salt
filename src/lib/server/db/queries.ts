import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from './index';
import { recipes } from './schema';
import type { SelectRecipe } from './schema';
import { type Recipe } from '$lib/obj/Recipe.svelte';
import {
  createRootRecipeNode,
  getRecipeState,
  type RecipeState,
} from '../bo/recipenodesbo';

export async function getAllRecipes(): Promise<SelectRecipe[]> {
  return db.select().from(recipes);
}

export async function getRecipeById(id: string) {
  return db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
}

/**
 * Returns the recipe metadata plus the materialized state derived from
 * replaying the recipe's node history.
 */
export async function getCompleteRecipeById(id: string): Promise<(SelectRecipe & RecipeState) | null> {
  const recipeResult = await getRecipeById(id);
  const recipeData = recipeResult[0];
  if (!recipeData) return null;

  const state = await getRecipeState(id);
  return {
    ...recipeData,
    ingredients: state.ingredients,
    directions: state.directions,
  };
}

/**
 * Insert a new recipe row AND its initial (empty) root node, so the history
 * is well-formed from the start.
 *
 * @param parentNodeId - when non-null, the new root node's parentNodeId points
 *   to an existing node, establishing this recipe as a fork/child of another.
 */
export async function saveNewRecipe(recipe: Recipe, parentNodeId: string | null = null): Promise<Recipe> {
  recipe.id = uuid();
  await db.insert(recipes).values({ id: recipe.id, name: recipe.name });
  await createRootRecipeNode(recipe.id, recipe.name, parentNodeId);
  return recipe;
}

/**
 * @deprecated Update goes through `updateRecipeState` in recipenodesbo, which
 * diffs the incoming recipe against the materialized current state and
 * appends a node to the history. This stub is kept for type compatibility
 * only.
 */
export async function saveRecipe(_recipe: Recipe): Promise<Recipe> {
  throw new Error(
    'saveRecipe is no longer the source of truth. Use updateRecipeState from $lib/server/bo/recipenodesbo.'
  );
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  // The ON DELETE CASCADE on recipe_nodes.recipe_id handles node cleanup.
  await db.delete(recipes).where(eq(recipes.id, recipeId));
}
