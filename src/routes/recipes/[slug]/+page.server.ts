import type { PageServerLoad } from './$types';
import { getCompleteRecipeById } from '../../../lib/server/db/queries';

type RecipePOJO = {
	id: string;
	name: string;
	ingredients: { id: string; name: string; amount: number; unit: string }[];
	directions: { id: string; body: string }[];
};

export const load: PageServerLoad = async ({ params }) => {
  const recipe = await getCompleteRecipeById(params.slug);
  if (!recipe) {
    throw new Error('Recipe not found');
  }
  return { recipe: recipe as RecipePOJO };
}
