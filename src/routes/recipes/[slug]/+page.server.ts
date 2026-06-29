import { readFileSync } from "fs";
import type { Actions, PageServerLoad } from './$types';
import { writeFile, readdir } from 'fs/promises';
import {getCompleteRecipeById } from '../../../lib/server/db/queries';

export const load: PageServerLoad = async ({ params }) => {
  const recipe = await getCompleteRecipeById(params.slug) as Recipe;
  return { recipe, recipeId: recipe.id }
};

export const actions = {
  save: async ({ request }) => {
    const data = await request.formData();
    console.log(request)
    const recipe = data.get('recipe') as string;
    const fileName = data.get('fileName') as string;
    await writeFile(`src/lib/assets/${fileName}`, recipe);
    return { success: true };
  }
} satisfies Actions;
