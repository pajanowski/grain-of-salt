import type { LayoutServerLoad } from './$types';
import { getRecipeTree } from '$lib/server/bo/recipenodesbo';
import { env } from '$env/dynamic/public';

export const load: LayoutServerLoad = async ({ depends, locals, cookies }) => {
	depends('app:recipes');
	const recipeTree = await getRecipeTree();

	const { session, user } = await locals.safeGetSession();

	// Guest mode is a plain cookie, not a Supabase session. Set by the
	// /auth/guest form action; cleared by /auth/logout (which also clears
	// any Supabase session).
	const isGuest = cookies.get('guest') === '1';

	const supabaseConfigured = Boolean(env.PUBLIC_SUPABASE_URL);

	return {
		recipeTree,
		session,
		user,
		isGuest,
		supabaseConfigured
	};
};
