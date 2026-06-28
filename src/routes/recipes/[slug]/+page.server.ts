import { readFileSync } from "fs";
import type { Actions, PageServerLoad } from './$types';
import { writeFile, readdir } from 'fs/promises';

export const load: PageServerLoad = async ({ params }) => {
  // const files = await readdir('src/lib/assets');
  // const recipes = files.filter((f) => f.endsWith('.json'));
  const recipeJson = readFileSync(`./src/lib/assets/${params.slug}`, 'utf8')
  const recipe = JSON.parse(recipeJson);
  return { recipe, fileName: params.slug }
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
