import type { RecipeNode } from "$lib/obj/RecipeNode.svelte";
import { db } from ".";
import { recipeNodes } from "./schema";

import { asc, eq, isNull } from 'drizzle-orm';

export async function getRecipeNodeById(recipeNodeId: string): Promise<RecipeNode | null> {
  console.log(recipeNodeId);
  const rows = await db
    .select()
    .from(recipeNodes)
    .where(eq(recipeNodes.id, recipeNodeId))
    .limit(1);

  console.log('rows');
  console.log(rows);
  return rows[0];
}
