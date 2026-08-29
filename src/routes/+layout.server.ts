import type { LayoutServerLoad } from './$types';
import { getRecipeTree } from '$lib/server/bo/recipenodesbo';
import { DEMO_USER_ID } from '$lib/server/db/schema';
import { env } from '$env/dynamic/public';

export const load: LayoutServerLoad = async ({ depends, locals, cookies }) => {
	depends('app:recipes');

	const { session, user } = await locals.safeGetSession();

	// Recipe-tree visibility:
	//  - Signed-in user: see their own recipes.
	//  - Guest (no Supabase session but has the guest cookie): see the
	//    shared demo tree (DEMO_USER_ID). Demo recipes are seeded and
	//    read-only from the guest's perspective — the bo layer enforces
	//    ownership on every write.
	const ownerId = user?.id ?? (cookies.get('guest') === '1' ? DEMO_USER_ID : null);

	const recipeTree = ownerId ? await getRecipeTree(ownerId) : [];
	const isGuest = cookies.get('guest') === '1';
	const supabaseConfigured = Boolean(env.PUBLIC_SUPABASE_URL);

	return {
		recipeTree,
		session,
		user,
		isGuest,
		ownerId,
		supabaseConfigured
	};
};
