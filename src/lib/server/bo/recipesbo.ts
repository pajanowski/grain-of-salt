import type { Recipe } from "$lib/obj/Recipe.svelte";
import { saveRecipe, deleteRecipe as deleteRecipeDb, saveNewRecipe as saveNewRecipeDb } from "../db/queries";

export async function saveNewRecipe(recipe: Recipe): Promise<Recipe> {
  recipe.id = ""
  return await saveNewRecipeDb(recipe)
}

export async function updateRecipe(recipe: Recipe): Promise<Recipe> {
  if (recipe.id == null || recipe.id.trim().length == 0) {
    throw new Error("Invalid Recipe ID")
  }

  return await saveRecipe(recipe);
}

export async function deleteRecipe(recipeId: string) {
  if (recipeId == null || recipeId.trim().length == 0) {
    throw new Error("Invalid Recipe ID")
  }

  return await deleteRecipeDb(recipeId)
}
