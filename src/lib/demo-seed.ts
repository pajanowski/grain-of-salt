/**
 * Static demo seed (ADR 0003 — Demo seed).
 *
 * Populated on first visit. Two root recipes so the recipe list has
 * something to expand/collapse. The seed is intentionally tiny —
 * enough to demonstrate the tree, the create form, and the fork
 * semantics, but not so much that the demo feels overwhelming.
 */
import type { RecipeSummary, RecipeTree } from './recipe-store';
import type { RecipeNode } from './obj/RecipeNode.svelte';

/**
 * The visitor's id in demo mode. Every demo recipe is owned by this
 * user so the layout's owner-scoped query has a stable value.
 */
export const DEMO_USER = {
	id: '00000000-0000-0000-0000-000000000001',
	email: 'demo@grain-of-salt.local',
	app_metadata: {},
	user_metadata: {},
	aud: 'authenticated',
	created_at: new Date(0).toISOString()
};

export interface SeedRecipeNode extends RecipeNode {
	/** Owning recipe id (== summary.id for root, parent node id for non-root). */
	recipeId: string;
}

const NODE_ROOT_A = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
const NODE_CHILD_A1 = 'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2';
const NODE_CHILD_A2 = 'a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3';
const NODE_ROOT_B = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1';

const SUMMARY_A = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SUMMARY_B = 'bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SUMMARY_A_CHILD = 'aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SUMMARY_A_CHILD_2 = 'aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

export const SEED_RECIPES: RecipeSummary[] = [
	{ id: SUMMARY_A, name: 'Pancakes', parentId: null },
	{ id: SUMMARY_A_CHILD, name: 'Pancakes (fluffy)', parentId: SUMMARY_A },
	{ id: SUMMARY_A_CHILD_2, name: 'Pancakes (vegan)', parentId: SUMMARY_A },
	{ id: SUMMARY_B, name: 'Tomato Soup', parentId: null }
];

/**
 * Map from recipe id → ordered list of nodes that make up its chain.
 * Each root recipe has a single node; each child summary sits on its
 * own node appended to its parent.
 */
export const SEED_NODES: SeedRecipeNode[] = [
	{
		id: NODE_ROOT_A,
		recipeId: SUMMARY_A,
		name: 'Pancakes',
		parentId: null,
		label: 'root',
		timestamp: new Date('2026-01-01T00:00:00Z'),
		ingredientChanges: [
			{
				id: 'pa-flour',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: 'i-flour', name: 'Flour', amount: 2, unit: 'cup' }
			},
			{
				id: 'pa-milk',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: 'i-milk', name: 'Milk', amount: 1.5, unit: 'cup' }
			},
			{
				id: 'pa-egg',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: 'i-egg', name: 'Egg', amount: 2, unit: '' }
			}
		],
		directionChanges: [
			{
				id: 'pa-d-mix',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: 'd-mix', body: 'Whisk dry, then wet, until just combined.' }
			},
			{
				id: 'pa-d-cook',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: 'd-cook', body: 'Cook on a buttered skillet, flipping when bubbles form.' }
			}
		]
	},
	{
		id: NODE_CHILD_A1,
		recipeId: SUMMARY_A_CHILD,
		name: 'Pancakes (fluffy)',
		parentId: NODE_ROOT_A,
		label: null,
		timestamp: new Date('2026-01-02T00:00:00Z'),
		ingredientChanges: [
			{
				id: 'paf-bp',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: 'i-bp', name: 'Baking powder', amount: 1, unit: 'tsp' }
			}
		],
		directionChanges: []
	},
	{
		id: NODE_CHILD_A2,
		recipeId: SUMMARY_A_CHILD_2,
		name: 'Pancakes (vegan)',
		parentId: NODE_ROOT_A,
		label: null,
		timestamp: new Date('2026-01-03T00:00:00Z'),
		ingredientChanges: [
			{
				id: 'pav-flax',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: 'i-flax', name: 'Flax egg', amount: 2, unit: '' }
			},
			{
				id: 'pav-rm-milk',
				changeType: 'remove',
				targetId: 'pa-milk',
				note: 'Replaced with oat milk.',
				body: null
			}
		],
		directionChanges: []
	},
	{
		id: NODE_ROOT_B,
		recipeId: SUMMARY_B,
		name: 'Tomato Soup',
		parentId: null,
		label: 'root',
		timestamp: new Date('2026-01-04T00:00:00Z'),
		ingredientChanges: [
			{
				id: 'ts-tomato',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: 'i-tomato', name: 'Crushed tomatoes', amount: 28, unit: 'oz' }
			},
			{
				id: 'ts-onion',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: 'i-onion', name: 'Onion', amount: 1, unit: '' }
			}
		],
		directionChanges: [
			{
				id: 'ts-d-simmer',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: 'd-simmer', body: 'Sweat the onion, add tomatoes, simmer 20 min, blend.' }
			}
		]
	}
];

/**
 * Build a Map keyed by node id for fast lookup. The writables keep
 * the same shape so demoNodes.subscribe(cb) sees node additions and
 * deletions as Map mutations.
 */
export const SEED_NODES_MAP: Map<string, SeedRecipeNode> = new Map(
	SEED_NODES.map((n) => [n.id, n])
);

/**
 * Per-recipe initial chain. The dispatch functions return RecipeTree
 * with `nodes` ordered root → ... → leaf, so we hand-build that list
 * here.
 */
export function seedChainFor(recipeId: string): SeedRecipeNode[] {
	const summary = SEED_RECIPES.find((r) => r.id === recipeId);
	if (!summary) return [];
	if (summary.parentId === null) {
		const root = SEED_NODES.find((n) => n.recipeId === recipeId && n.parentId === null);
		return root ? [root] : [];
	}
	// Child summary — find the leaf node for this summary, walk up to root.
	const leaf = SEED_NODES.find((n) => n.recipeId === recipeId);
	if (!leaf) return [];
	const out: SeedRecipeNode[] = [];
	let current: SeedRecipeNode | undefined = leaf;
	while (current) {
		out.unshift(current);
		if (current.parentId === null) break;
		current = SEED_NODES.find((n) => n.id === current!.parentId);
	}
	return out;
}

/** Helper used by resetDemoState and the initial demoStore.list(). */
export function initialDemoTrees(): RecipeTree[] {
	return SEED_RECIPES.map((summary) => ({ summary, nodes: seedChainFor(summary.id) }));
}
