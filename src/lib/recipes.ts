/**
 * Recipe dispatch functions (ADR 0003 — Dispatch functions).
 *
 * Every component that wants to mutate or read recipes calls one of
 * these functions instead of reaching into `$lib/api` directly. The
 * function chooses the right `RecipeStore` at call time — the supabase
 * adapter on the server, the demo adapter on the client when
 * `isDemoMode(window, env) === true`, otherwise the supabase adapter
 * on the client too.
 *
 * Components never see which adapter is active; the demo mode is
 * selected by hostname + env, not by anything the component does.
 */
import type { RecipeStore, RecipeSummary, RecipeTree, NodeChanges } from './recipe-store';
import { isDemoMode } from './demo-init';
import { supabaseStore } from './recipe-store.supabase';

/**
 * Choose the right adapter for this environment. On the server, only
 * the supabase adapter exists. On the client, demo mode picks the
 * demo adapter; otherwise the supabase adapter is used so the
 * browser hits `/api/*` exactly as it always did.
 *
 * Lazy-loaded so the demo adapter never ends up in the server bundle
 * (it depends on `svelte/store` writables that work fine on both
 * sides, but keeping it client-only respects ADR 0003's "no SSR
 * coupling" requirement and avoids needless bytes shipped to node).
 */
let demoStorePromise: Promise<RecipeStore> | null = null;
function loadDemoStore(): Promise<RecipeStore> {
	if (!demoStorePromise) {
		demoStorePromise = import('./recipe-store.demo').then((m) => m.demoStore);
	}
	return demoStorePromise;
}

export function getRecipeStore(): Promise<RecipeStore> {
	if (typeof window === 'undefined') {
		return Promise.resolve(supabaseStore);
	}
	const envFlag =
		typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env
			? (import.meta as { env: Record<string, string> }).env.VITE_DEMO_MODE
			: undefined;
	if (isDemoMode(window, envFlag)) {
		return loadDemoStore();
	}
	return Promise.resolve(supabaseStore);
}

export async function listRecipes(): Promise<RecipeSummary[]> {
	const store = await getRecipeStore();
	return store.list();
}

export async function loadRecipeTree(id: string): Promise<RecipeTree | null> {
	const store = await getRecipeStore();
	return store.get(id);
}

export async function createRecipe(name: string): Promise<{ id: string }> {
	const store = await getRecipeStore();
	return store.create(name);
}

export async function renameRecipe(id: string, name: string): Promise<void> {
	const store = await getRecipeStore();
	return store.rename(id, name);
}

export async function forkRecipe(nodeId: string, name?: string): Promise<{ id: string }> {
	const store = await getRecipeStore();
	return store.fork(nodeId, name);
}

export async function deleteRecipe(id: string): Promise<void> {
	const store = await getRecipeStore();
	return store.remove(id);
}

export async function saveNodeChanges(nodeId: string, changes: NodeChanges): Promise<void> {
	const store = await getRecipeStore();
	return store.saveNode(nodeId, changes);
}
