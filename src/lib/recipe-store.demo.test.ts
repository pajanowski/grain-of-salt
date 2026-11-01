import { describe, it, expect, beforeEach } from 'vitest';
import { demoStore, resetDemoState, demoNodes, demoRecipes } from './recipe-store.demo';
import {
	SEED_SIMPLE_ID,
	SEED_FRENCH_ID,
	SEED_CHEESE_ID,
	SEED_DENVER_ID,
	SEED_SPICY_DENVER_ID
} from './demo-seed';
import { get } from 'svelte/store';

describe('demoStore (client-side in-memory localStorage adapter)', () => {
	beforeEach(() => {
		resetDemoState();
	});

	it('loads initial seed tree and hierarchy correctly', async () => {
		const tree = await demoStore.listTree();
		expect(tree.length).toBeGreaterThanOrEqual(2); // Simple Omelette and Auguste's Bouillabaisse

		const simpleRoot = tree.find((t) => t.id === SEED_SIMPLE_ID);
		expect(simpleRoot).toBeDefined();
		expect(simpleRoot?.children.length).toBe(2); // French and Cheese

		const cheeseBranch = simpleRoot?.children.find((c) => c.id === SEED_CHEESE_ID);
		expect(cheeseBranch).toBeDefined();
		expect(cheeseBranch?.children.length).toBe(1); // Denver

		const denverBranch = cheeseBranch?.children.find((c) => c.id === SEED_DENVER_ID);
		expect(denverBranch?.children.length).toBe(1); // Spicy Denver
	});

	it('computes dashboard recent recipes and leaf nodes', async () => {
		const dashboard = await demoStore.getDashboard(5);
		expect(dashboard.length).toBeGreaterThan(0);

		// Simple Omelette root should identify Spicy Denver as latest leaf
		const omeletteRoot = dashboard.find((d) => d.rootId === SEED_SIMPLE_ID);
		expect(omeletteRoot).toBeDefined();
		expect(omeletteRoot?.leafId).toBe(SEED_SPICY_DENVER_ID);
		expect(omeletteRoot?.forkCount).toBe(2); // Direct children: French and Cheese
	});

	it('returns favorited demo recipes', async () => {
		const favorites = await demoStore.getFavorites();
		expect(favorites.length).toBeGreaterThan(0);

		const frenchFav = favorites.find((f) => f.id === SEED_FRENCH_ID);
		expect(frenchFav).toBeDefined();

		// Toggle favorite off
		const updatedState = await demoStore.toggleFavorite(SEED_FRENCH_ID);
		expect(updatedState).toBe(false);

		const updatedFavs = await demoStore.getFavorites();
		expect(updatedFavs.find((f) => f.id === SEED_FRENCH_ID)).toBeUndefined();
	});

	it('reconstructs full recipe state and ancestry chain via getRecipeView', async () => {
		const view = await demoStore.getRecipeView(SEED_SPICY_DENVER_ID);
		expect(view).not.toBeNull();
		if (!view) return;

		expect(view.recipe.id).toBe(SEED_SIMPLE_ID); // Recipe identity is root
		expect(view.currentNode.id).toBe(SEED_SPICY_DENVER_ID);

		// History chain: Simple -> Cheese -> Denver -> Spicy Denver
		expect(view.history.length).toBe(4);
		expect(view.history[0].id).toBe(SEED_SIMPLE_ID);
		expect(view.history[1].id).toBe(SEED_CHEESE_ID);
		expect(view.history[2].id).toBe(SEED_DENVER_ID);
		expect(view.history[3].id).toBe(SEED_SPICY_DENVER_ID);

		// Parent chain breadcrumbs: [Cheese, Denver] (excludes root and leaf)
		expect(view.parentChain.length).toBe(2);
		expect(view.parentChain[0].id).toBe(SEED_CHEESE_ID);
		expect(view.parentChain[1].id).toBe(SEED_DENVER_ID);

		// Replayed ingredients should include Eggs, Cheddar, Diced Ham, Jalapeño
		const ingNames = view.recipe.ingredients.map((i) => i.name);
		expect(ingNames).toContain('Eggs');
		expect(ingNames).toContain('Cheddar Cheese');
		expect(ingNames).toContain('Diced Ham');
		expect(ingNames).toContain('Jalapeño');
	});

	it('supports creating, renaming, and removing recipes', async () => {
		// Create
		const { id: newId } = await demoStore.create('Pancakes');
		expect(newId).toBeDefined();

		const node = await demoStore.getNode(newId);
		expect(node?.name).toBe('Pancakes');
		expect(node?.parentId).toBeNull();

		// Rename
		await demoStore.rename(newId, 'Fluffy Pancakes');
		const renamedNode = await demoStore.getNode(newId);
		expect(renamedNode?.name).toBe('Fluffy Pancakes');

		// Remove
		await demoStore.remove(newId);
		const removedNode = await demoStore.getNode(newId);
		expect(removedNode).toBeNull();
	});

	it('supports forking and saving changes', async () => {
		// Fork from French Omelette
		const { id: forkId } = await demoStore.fork(SEED_FRENCH_ID, 'Truffle French Omelette');
		expect(forkId).toBeDefined();

		const forkNode = await demoStore.getNode(forkId);
		expect(forkNode?.name).toBe('Truffle French Omelette');
		expect(forkNode?.parentId).toBe(SEED_FRENCH_ID);

		// Save node changes
		const truffleIngId = '00000000-0001-0000-0000-000000000099';
		await demoStore.saveNode(
			forkId,
			[
				{
					id: '00000000-0003-0000-0000-000000000099',
					changeType: 'add',
					targetId: null,
					note: 'Luxury finish',
					body: { id: truffleIngId, name: 'Black Truffle', amount: 5, unit: 'g' }
				}
			],
			[]
		);

		const updatedForkView = await demoStore.getRecipeView(forkId);
		expect(updatedForkView?.recipe.ingredients.map((i) => i.name)).toContain('Black Truffle');
		// Should inherit Eggs and Butter from ancestors
		expect(updatedForkView?.recipe.ingredients.map((i) => i.name)).toContain('Eggs');
		expect(updatedForkView?.recipe.ingredients.map((i) => i.name)).toContain('Butter');
	});

	it('resets demo state back to canonical seed', async () => {
		await demoStore.create('Temporary Recipe');
		let tree = await demoStore.listTree();
		expect(tree.some((t) => t.name === 'Temporary Recipe')).toBe(true);

		resetDemoState();

		tree = await demoStore.listTree();
		expect(tree.some((t) => t.name === 'Temporary Recipe')).toBe(false);
	});
});
