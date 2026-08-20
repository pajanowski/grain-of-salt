import type { Recipe } from "$lib/obj/Recipe.svelte";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { recipeNodes } from "../db/schema";
import {
  createRootRecipeNode,
  getRecipeNodesByRecipeId,
  updateRecipeState,
} from "./recipenodesbo";
import type { RecipeNode } from "$lib/obj/RecipeNode.svelte";

/**
 * Create a new recipe. The initial root node is created in the same flow so
 * the history is well-formed from the start.
 *
 * After creation, the recipe's identity is the new root node's id, which is
 * what `recipe.id` is set to.
 */
export async function saveNewRecipe(
  recipe: Recipe,
  parentNodeId: string | null = null,
): Promise<Recipe> {
  recipe.id = "";
  const root = await createRootRecipeNode(recipe.name, parentNodeId);
  recipe.id = root.id;
  return recipe;
}

/**
 * Create a new recipe forked from an existing one. The new recipe's root
 * has parentNodeId pointing to the source's root node — establishing the
 * "forked from" relationship at the recipe hierarchy level.
 */
export async function forkRecipe(fromRootNodeId: string, newName: string): Promise<RecipeNode> {
  return await createRootRecipeNode(newName, fromRootNodeId);
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

/**
 * Delete a recipe by deleting its root node. The ON DELETE CASCADE on
 * recipe_nodes.parent_id removes the rest of the chain in one statement.
 */
export async function deleteRecipe(rootNodeId: string) {
  if (!rootNodeId || rootNodeId.trim().length === 0) {
    throw new Error("Invalid Recipe ID");
  }
  await db.delete(recipeNodes).where(eq(recipeNodes.id, rootNodeId));
}

/**
 * Update the name on every node in the recipe's history. The recipe's name
 * is denormalized onto each node so history labels stay meaningful after
 * edits.
 */
export async function renameRecipe(rootNodeId: string, newName: string): Promise<void> {
  const trimmed = newName.trim();
  if (!rootNodeId || rootNodeId.trim().length === 0) {
    throw new Error("Invalid Recipe ID");
  }
  if (!trimmed) {
    throw new Error("Recipe name cannot be empty");
  }
  const nodes = await getRecipeNodesByRecipeId(rootNodeId);
  await db.transaction(async (tx) => {
    for (const node of nodes) {
      await tx
        .update(recipeNodes)
        .set({ name: trimmed })
        .where(eq(recipeNodes.id, node.id));
    }
  });
}

