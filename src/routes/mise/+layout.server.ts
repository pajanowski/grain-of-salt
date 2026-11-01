import type { LayoutServerLoad } from './$types';
import { getRecipeTree } from '$lib/server/bo/recipenodesbo';
import { env } from '$env/dynamic/public';

export const load: LayoutServerLoad = async ({ depends, locals }) => {
	depends('app:recipes');
	depends('app:recipe-tree');

	const demoMode = Boolean((locals as any).demoMode);
	const { session, user } = await locals.safeGetSession();

	const ownerId = user?.id ?? null;
	const recipeTree = ownerId && !demoMode ? await getRecipeTree(ownerId) : [];
	const supabaseConfigured = Boolean(env.PUBLIC_SUPABASE_URL);

	return {
		demoMode,
		recipeTree,
		session,
		user,
		ownerId,
		supabaseConfigured
	};
};
