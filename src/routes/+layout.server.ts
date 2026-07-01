import type { PageServerLoad } from "./$types";
import { getAllRecipes } from "$lib/server/db/queries";

export const load: PageServerLoad = async ({ depends }) => {
  depends('app:recipes');
  const recipes = await getAllRecipes()
  // console.log(allRecipes)
  // const files = await readdir('src/lib/assets');
  // const recipes = files.filter((f) => f.endsWith('.json'));
  return { recipes };
};
