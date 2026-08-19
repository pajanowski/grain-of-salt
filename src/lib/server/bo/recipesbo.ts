import type { Recipe } from "$lib/obj/Recipe.svelte";
import { NewRecipe } from "$lib/obj/Recipe.svelte";
import { saveNewRecipe as saveNewRecipeDb, deleteRecipe as deleteRecipeDb } from "../db/queries";
import { updateRecipeState } from "./recipenodesbo";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { recipes, recipeNodes } from "../db/schema";

/**
 * Create a new recipe. The initial root node is created in the same flow so
 * the history is well-formed from the start.
 */
export async function saveNewRecipe(recipe: Recipe, parentNodeId: string | null = null): Promise<Recipe> {
  recipe.id = "";
  return await saveNewRecipeDb(recipe, parentNodeId);
}

/**
 * Create a new recipe forked from an existing one. The new root node's
 * parentNodeId points to the original recipe's root node — establishing
 * the "forked from" relationship at the recipe hierarchy level.
 */
export async function forkRecipe(fromRootNodeId: string, newName: string): Promise<Recipe> {
  const recipe = NewRecipe(newName);
  return await saveNewRecipeDb(recipe, fromRootNodeId);
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

/**
 * Update the name on the recipe row and every node in its history. The
 * recipe's name is denormalized onto each node so history labels stay
 * meaningful after edits.
 */
export async function renameRecipe(recipeId: string, newName: string): Promise<void> {
  const trimmed = newName.trim();
  if (!recipeId || recipeId.trim().length === 0) {
    throw new Error("Invalid Recipe ID");
  }
  if (!trimmed) {
    throw new Error("Recipe name cannot be empty");
  }
  await db.transaction(async (tx) => {
    await tx.update(recipes).set({ name: trimmed }).where(eq(recipes.id, recipeId));
    await tx
      .update(recipeNodes)
      .set({ name: trimmed })
      .where(eq(recipeNodes.recipeId, recipeId));
  });
}
