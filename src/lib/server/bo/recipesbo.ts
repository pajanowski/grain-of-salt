import type { Recipe } from "$lib/obj/Recipe.svelte";
import { saveNewRecipe as saveNewRecipeDb, deleteRecipe as deleteRecipeDb } from "../db/queries";
import { updateRecipeState } from "./recipenodesbo";

/**
 * Create a new recipe. The initial root node is created in the same flow so
 * the history is well-formed from the start.
 */
export async function saveNewRecipe(recipe: Recipe): Promise<Recipe> {
  recipe.id = "";
  return await saveNewRecipeDb(recipe);
}

/**
 * Apply a full-recipe PUT by diffing against the current materialized state
 * and appending a node to the recipe's history.
 */
export async function updateRecipe(recipe: Recipe): Promise<Recipe> {
  if (!recipe.id || recipe.id.trim().length === 0) {
    throw new Error("Invalid Recipe ID");
  }
  await updateRecipeState(recipe);
  return recipe;
}

export async function deleteRecipe(recipeId: string) {
  if (!recipeId || recipeId.trim().length === 0) {
    throw new Error("Invalid Recipe ID");
  }
  return await deleteRecipeDb(recipeId);
}
