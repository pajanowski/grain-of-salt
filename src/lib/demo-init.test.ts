import { describe, it, expect } from 'vitest';
import { isDemoHost, getDemoUrl } from './demo-init';
import { SEED_RECIPES, SEED_NODES, DEMO_USER_ID, SEED_SIMPLE_ID } from './demo-seed';
import { makeStubSupabase } from './supabase-stub';

describe('demo-init & seed & stub', () => {
	it('detects demo hosts correctly', () => {
		expect(isDemoHost('demo.grainofsalt.app')).toBe(true);
		expect(isDemoHost('demo.local')).toBe(true);
		expect(isDemoHost('demo.localhost:5173')).toBe(true);
		expect(isDemoHost('app.grainofsalt.app')).toBe(false);
		expect(isDemoHost('localhost')).toBe(false);
		expect(isDemoHost('')).toBe(false);
	});

	it('computes demo url appropriately for various hosts', () => {
		expect(getDemoUrl(new URL('http://localhost:5173/'))).toBe('http://demo.localhost:5173/mise');
		expect(getDemoUrl(new URL('http://127.0.0.1:4173/'))).toBe('http://demo.localhost:4173/mise');
		expect(getDemoUrl(new URL('https://grainofsalt.app/'))).toBe('https://demo.grainofsalt.app/mise');
		expect(getDemoUrl(new URL('https://app.grainofsalt.app/'))).toBe('https://demo.grainofsalt.app/mise');
		expect(getDemoUrl(new URL('http://demo.localhost:5173/'))).toBe('/mise');
		expect(getDemoUrl(new URL('https://demo.grainofsalt.app/'))).toBe('/mise');
	});

	it('provides valid canonical seed recipes and nodes', () => {
		expect(SEED_RECIPES.length).toBeGreaterThanOrEqual(5);
		expect(SEED_NODES.length).toBeGreaterThanOrEqual(5);

		const rootRecipe = SEED_RECIPES.find((r) => r.id === SEED_SIMPLE_ID);
		expect(rootRecipe).toBeDefined();
		expect(rootRecipe?.parentId).toBeNull();

		const rootNode = SEED_NODES.find((n) => n.id === SEED_SIMPLE_ID);
		expect(rootNode).toBeDefined();
		expect(rootNode?.ingredientChanges.length).toBeGreaterThan(0);
		expect(rootNode?.directionChanges.length).toBeGreaterThan(0);
	});

	it('creates a functioning stub supabase client', async () => {
		const stub = makeStubSupabase();
		const { data: sessionData } = await stub.auth.getSession();
		expect(sessionData.session?.user.id).toBe(DEMO_USER_ID);

		const { data: rows } = await stub.from('recipe_nodes').select('*');
		expect(Array.isArray(rows)).toBe(true);

		const { data: rpcData } = await stub.rpc('get_recipe_chain', { start_id: SEED_SIMPLE_ID });
		expect(Array.isArray(rpcData)).toBe(true);
	});
});
