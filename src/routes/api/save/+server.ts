import type { RequestHandler } from './$types';
import type { Recipe } from '$lib/obj/Recipe.svelte';
import { saveNewRecipe, updateRecipe } from '$lib/server/bo/recipesbo';

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.formData();
  const recipe: Recipe = JSON.parse(data.get('recipe') as string)
  const ret = await saveNewRecipe(recipe)
  return new Response(JSON.stringify(ret));
}

export const PUT: RequestHandler = async ({ request }) => {
  const data = await request.formData();
  const recipe: Recipe = JSON.parse(data.get('recipe') as string)

  try {
    const ret = await updateRecipe(recipe)
    return new Response(JSON.stringify(ret));
  } catch (e) {
    return new Response((e as Error).message, {
      status: 500
    })
  }
};
