import type { PageServerLoad } from './$types';
import { getRecipeDashboard, getRecipeFavorites } from '$lib/server/bo/recipenodesbo';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	const ownerId = user?.id ?? null;
	const dashboard = ownerId ? await getRecipeDashboard(ownerId) : [];
	const favorites = ownerId ? await getRecipeFavorites(ownerId) : [];

	return {
		dashboard,
		favorites
	};
};
