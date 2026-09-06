import type { LayoutServerLoad } from './$types';
import { getRecipeTree, type RecipeTreeNode } from '$lib/server/bo/recipenodesbo';
import { env } from '$env/dynamic/public';
import { isDemoServer } from '$lib/demo-init';
import { DEMO_USER, SEED_RECIPES } from '$lib/demo-seed';

export const load: LayoutServerLoad = async ({ depends, locals, url }) => {
	depends('app:recipes');
	depends('app:recipe-tree');

	const demoEnv =
		(import.meta as { env?: Record<string, string> }).env?.VITE_DEMO_MODE ??
		env.VITE_DEMO_MODE;
	if (isDemoServer(url.hostname, demoEnv)) {
		// Convert flat RecipeSummary[] into nested RecipeTreeNode[] so the
		// shape matches what RecipeList (and the production path) consume.
		const recipeTree = buildDemoTree(SEED_RECIPES);
		return {
			demoMode: true,
			recipeTree,
			session: { user: DEMO_USER },
			user: DEMO_USER,
			ownerId: DEMO_USER.id,
			supabaseConfigured: false
		};
	}
	// Signed-in users see their own recipes. Unauthenticated browsers
	// (no Supabase session) see an empty list — they must sign in.
	const ownerId = user?.id ?? null;
	const recipeTree: RecipeTreeNode[] = ownerId ? await getRecipeTree(ownerId) : [];
	const supabaseConfigured = Boolean(env.PUBLIC_SUPABASE_URL);

	return {
		demoMode: false,
		recipeTree,
		session,
		user,
		ownerId,
		supabaseConfigured
	};
};

/**
 * Build a nested tree of RecipeTreeNode from flat RecipeSummary[].
 * Each non-root summary's parentId is the source recipe summary's id;
 * children are grouped under their parent summary.
 */
function buildDemoTree(summaries: typeof SEED_RECIPES): RecipeTreeNode[] {
	const summaryById = new Map(summaries.map((s) => [s.id, s]));
	const childrenByParent = new Map<string, typeof summaries>();
	for (const s of summaries) {
		if (s.parentId === null) continue;
		const arr = childrenByParent.get(s.parentId) ?? [];
		arr.push(s);
		childrenByParent.set(s.parentId, arr);
	}
	function attach(summary: typeof SEED_RECIPES[number]): RecipeTreeNode {
		const kids = childrenByParent.get(summary.id) ?? [];
		return {
			id: summary.id,
			name: summary.name,
			parentId: summary.parentId,
			children: kids.map(attach)
		};
	}
	return summaries.filter((s) => s.parentId === null).map(attach);
}
