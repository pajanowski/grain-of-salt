import type { LayoutServerLoad } from './$types';
import { getRecipeTree } from '$lib/server/bo/recipenodesbo';
import { env } from '$env/dynamic/public';

export const load: LayoutServerLoad = async ({ depends, locals }) => {
	depends('app:recipes');
	depends('app:recipe-tree');

	const { session, user } = await locals.safeGetSession();

	// Signed-in users see their own recipes. Unauthenticated browsers
	// (no Supabase session) see an empty list — they must sign in.
	const ownerId = user?.id ?? null;
	const recipeTree = ownerId ? await getRecipeTree(ownerId) : [];
	const supabaseConfigured = Boolean(env.PUBLIC_SUPABASE_URL);

	return {
		recipeTree,
		session,
		user,
		ownerId,
		supabaseConfigured
	};
};
