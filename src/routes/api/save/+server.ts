import type { RequestHandler } from './$types';
import { NewRecipe, type Recipe } from '$lib/obj/Recipe.svelte';
import { saveNewRecipe, updateRecipe } from '$lib/server/bo/recipesbo';

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.formData();
  const recipeName = data.get('recipeName') as string;
  const newRecipe = NewRecipe(recipeName)
  const ret = await saveNewRecipe(newRecipe);
  return new Response(JSON.stringify(ret));
}

export const PUT: RequestHandler = async ({ request }) => {
  const data = await request.formData();
  const recipe: Recipe = JSON.parse(data.get('recipe') as string)
  // recipe.id IS the root node id, which is the recipe's identity in the
  // node-only model. updateRecipeState diffs against the chain rooted by
  // this id and appends a node on save.
  try {
    const ret = await updateRecipe(recipe)
    return new Response(JSON.stringify(ret));
  } catch (e) {
    return new Response((e as Error).message, {
      status: 500
    })
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  return new Response()
};
