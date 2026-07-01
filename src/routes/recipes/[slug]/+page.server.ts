import type { PageServerLoad } from './$types';
import { getCompleteRecipeById } from '../../../lib/server/db/queries';

export const load: PageServerLoad = async ({ params }) => {
  const recipe = await getCompleteRecipeById(params.slug); if (!recipe) {
    throw new Error('Recipe not found');
  }
  return { recipe };
}
