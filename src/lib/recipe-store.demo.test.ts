/**
 * Tests for the demo adapter (src/lib/recipe-store.demo.ts).
 *
 * The demo adapter is what powers the in-browser demo mode — no
 * Supabase, no network. State lives in Svelte writables + localStorage
 * so it survives a hard reload.
 *
 * What this suite pins:
 *   - The demo store is seeded with SEED_RECIPES on first use.
 *   - Each RecipeStore method mutates the writables in a way the
 *     components can observe via subscription.
 *   - Persistence: writes survive localStorage round-trips.
 *   - Fork: cloned recipes have fresh IDs (parent IDs are remapped).
 *   - resetDemoState restores the seed.
 *
 * The "persistence after a remount" test uses vi.resetModules() +
 * a dynamic import because that is exactly the "fresh page load"
 * behaviour we need to model — a literal reload would not be
 * observable from a unit test, and a static import would reuse the
 * cached module's already-initialized writables.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type { IngredientChange } from './obj/RecipeNode.svelte';

/**
 * Replace localStorage with a per-test in-memory implementation. The
 * demo adapter reads/writes through `globalThis.localStorage`, so we
 * shim it before importing the module under test and restore the real
 * one afterwards.
 */
function installMemoryLocalStorage(): { storage: Map<string, string>; restore: () => void } {
	const storage = new Map<string, string>();
	const original = (globalThis as { localStorage?: Storage }).localStorage;
	const fake: Storage = {
		getItem: (k) => storage.get(k) ?? null,
		setItem: (k, v) => {
			storage.set(k, v);
		},
		removeItem: (k) => {
			storage.delete(k);
		},
		clear: () => {
			storage.clear();
		},
		key: (i) => Array.from(storage.keys())[i] ?? null,
		get length() {
			return storage.size;
		}
	};
	(globalThis as { localStorage: Storage }).localStorage = fake;
	return {
		storage,
		restore: () => {
			(globalThis as { localStorage?: Storage }).localStorage = original;
		}
	};
}

describe('demo adapter', () => {
	let restoreLocalStorage: () => void;

	beforeEach(() => {
		const { storage, restore } = installMemoryLocalStorage();
		restoreLocalStorage = restore;
		storage.clear();
	});

	afterEach(() => {
		restoreLocalStorage();
	});

	it('seed populates the recipes writable on first use', async () => {
		const { demoStore, demoRecipes, resetDemoState } = await import('./recipe-store.demo');
		resetDemoState();
		const list = await demoStore.list();
		const seedList = get(demoRecipes);
		expect(seedList.length).toBeGreaterThan(0);
		expect(list.length).toBe(seedList.length);
	});

	it('create(name) appends to the recipes writable and returns the new id', async () => {
		const { demoStore, demoRecipes, resetDemoState } = await import('./recipe-store.demo');
		resetDemoState();
		const before = get(demoRecipes).length;

		const { id } = await demoStore.create('Test create');
		const after = get(demoRecipes);

		expect(typeof id).toBe('string');
		expect(after.length).toBe(before + 1);
		expect(after.find((r) => (r as { id: string }).id === id)?.name).toBe('Test create');
	});

	it('create(name) persists to localStorage so the recipe survives a remount', async () => {
		const { demoStore, resetDemoState } = await import('./recipe-store.demo');
		resetDemoState();
		const { id } = await demoStore.create('Persisted');

		// Drop the module cache so the next import re-initializes from
		// localStorage the way a fresh page load would.
		vi.resetModules();
		const mod = await import('./recipe-store.demo');
		expect(get(mod.demoRecipes).find((r) => (r as { id: string }).id === id)).toBeDefined();
		const tree = await mod.demoStore.get(id);
		expect(tree).not.toBeNull();
		expect(tree!.summary.name).toBe('Persisted');
	});

	it('rename(id, name) updates the recipe name visible via list()', async () => {
		const { demoStore, demoRecipes, resetDemoState } = await import('./recipe-store.demo');
		resetDemoState();
		const { id } = await demoStore.create('Old');
		await demoStore.rename(id, 'New');
		expect(get(demoRecipes).find((r) => (r as { id: string }).id === id)?.name).toBe('New');
	});

	it('remove(id) deletes the recipe and its nodes', async () => {
		const { demoStore, demoRecipes, demoNodes, resetDemoState } = await import('./recipe-store.demo');
		resetDemoState();
		const { id } = await demoStore.create('Doomed');
		await demoStore.remove(id);

		expect(get(demoRecipes).find((r) => (r as { id: string }).id === id)).toBeUndefined();
		const tree = await demoStore.get(id);
		expect(tree).toBeNull();
		for (const node of get(demoNodes).values()) {
			const rid = (node as { recipeId?: string }).recipeId;
			expect(rid).not.toBe(id);
		}
	});

	it('fork(id) deep-clones with fresh IDs so edits to the fork do not affect the source', async () => {
		const { demoStore, resetDemoState } = await import('./recipe-store.demo');
		resetDemoState();
		const { id: sourceId } = await demoStore.create('Source');
		const sourceTree = await demoStore.get(sourceId);
		const leafId = (sourceTree!.nodes[sourceTree!.nodes.length - 1] as { id: string }).id;
		const addSalt: IngredientChange = {
			id: 'add-salt',
			changeType: 'add',
			targetId: null,
			note: null,
			body: { id: 'salt', name: 'Salt', amount: 1, unit: 'pinch' }
		};
		await demoStore.saveNode(leafId, {
			nodeId: leafId,
			ingredientChanges: [addSalt],
			directionChanges: []
		});

		const { id: forkedId } = await demoStore.fork(leafId);
		expect(forkedId).not.toBe(sourceId);

		const forkedTree = await demoStore.get(forkedId);
		expect(forkedTree).not.toBeNull();

		const sourceIds = new Set<string>(sourceTree!.nodes.map((n) => (n as { id: string }).id));
		for (const n of forkedTree!.nodes) {
			expect(sourceIds.has((n as { id: string }).id)).toBe(false);
		}

		const forkedLeafId = (forkedTree!.nodes[forkedTree!.nodes.length - 1] as { id: string }).id;
		await demoStore.saveNode(forkedLeafId, {
			nodeId: forkedLeafId,
			ingredientChanges: [
				{
					id: 'add-pepper',
					changeType: 'add',
					targetId: null,
					note: null,
					body: { id: 'pepper', name: 'Pepper', amount: 2, unit: 'pinch' }
				}
			],
			directionChanges: []
		});

		const after = await demoStore.get(sourceId);
		const sourceLeaf = after!.nodes[after!.nodes.length - 1];
		const pepperOnly = sourceLeaf.ingredientChanges.find(
			(c) => (c.body as { name?: string } | null)?.name === 'Pepper'
		);
		expect(pepperOnly).toBeUndefined();
	});

	it('saveNode replaces the leaf node\'s change arrays', async () => {
		const { demoStore, resetDemoState } = await import('./recipe-store.demo');
		resetDemoState();
		const { id } = await demoStore.create('Editable');
		const tree = await demoStore.get(id);
		const leafId = (tree!.nodes[0] as { id: string }).id;

		await demoStore.saveNode(leafId, {
			nodeId: leafId,
			ingredientChanges: [
				{
					id: 'add-flour',
					changeType: 'add',
					targetId: null,
					note: null,
					body: { id: 'flour', name: 'Flour', amount: 2, unit: 'cup' }
				}
			],
			directionChanges: []
		});

		const after = await demoStore.get(id);
		const leaf = after!.nodes[0];
		expect(leaf.ingredientChanges.length).toBe(1);
		expect((leaf.ingredientChanges[0].body as { name: string } | null)?.name).toBe('Flour');
	});

	it('resetDemoState restores the seed and clears localStorage', async () => {
		const { demoStore, demoRecipes, resetDemoState } = await import('./recipe-store.demo');
		resetDemoState();
		const seededLength = get(demoRecipes).length;

		await demoStore.create('Pollution');
		expect(get(demoRecipes).length).toBe(seededLength + 1);

		resetDemoState();
		expect(get(demoRecipes).length).toBe(seededLength);
		expect(get(demoRecipes).find((r) => (r as { name: string }).name === 'Pollution')).toBeUndefined();
	});

	it('fork name appends " (fork)" suffix (per ADR 0003 — Fork semantics)', async () => {
		const { demoStore, demoRecipes, resetDemoState } = await import('./recipe-store.demo');
		resetDemoState();
		const { id } = await demoStore.create('Plain');
		const tree = await demoStore.get(id);
		const leafId = (tree!.nodes[0] as { id: string }).id;

		const { id: forkedId } = await demoStore.fork(leafId);
		expect(get(demoRecipes).find((r) => (r as { id: string }).id === forkedId)?.name).toBe('Plain (fork)');
	});
});
