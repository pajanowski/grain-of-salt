import type { PageServerLoad } from "./$types";
import { getRecipeTree } from "$lib/server/bo/recipenodesbo";

export const load: PageServerLoad = async ({ depends }) => {
  depends('app:recipes');
  const recipeTree = await getRecipeTree();
  return { recipeTree };
};
