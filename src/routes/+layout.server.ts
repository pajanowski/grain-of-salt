import { readdir } from "fs/promises";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { getAllRecipes } from "$lib/server/db/queries";

export const load: PageServerLoad = async () => {
  const recipes = await getAllRecipes()
  // console.log(allRecipes)
  // const files = await readdir('src/lib/assets');
  // const recipes = files.filter((f) => f.endsWith('.json'));
  return { recipes };
};
