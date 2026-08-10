import type { RequestHandler } from './$types';
import { deleteRecipe } from '$lib/server/bo/recipesbo';

export const DELETE: RequestHandler = async ({ params }) => {
  const recipeId = params.id;

  try {
    console.log(recipeId)
    await deleteRecipe(recipeId);
    return new Response(null, { status: 200 });
  } catch (e) {
    return new Response((e as Error).message, {
      status: 500
    });
  }
};

