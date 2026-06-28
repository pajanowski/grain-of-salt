import { readdir } from "fs/promises";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  console.log("load")
  const files = await readdir('src/lib/assets');
  const recipes = files.filter((f) => f.endsWith('.json'));
  return { recipes };
};
