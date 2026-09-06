/**
 * Supabase-backed RecipeStore (ADR 0003 — Supabase adapter).
 *
 * Thin wrapper around the existing `src/lib/api.ts` axios client and
 * its `/api/*` endpoints. Production reads/writes go through the
 * same pipeline they always did — the refactor swaps call sites to
 * the dispatch functions in `src/lib/recipes.ts`, which route here.
 *
 * Why an adapter instead of continuing to call `api.*` directly?
 *   - The `RecipeStore` interface is the contract every UI component
 *     can be tested against without spinning up the real backend.
 *   - The dispatch functions have typed signatures; the bare `api.*`
 *     pipeline forced every call site to parse URL params / bodies.
 *   - The demo adapter satisfies the same interface, so swapping
 *     implementations is a single import swap.
 */
import { api } from './api';
import type { RecipeStore, RecipeSummary, RecipeTree, NodeChanges } from './recipe-store';

export const supabaseStore: RecipeStore = {
	async list(): Promise<RecipeSummary[]> {
		throw new Error(
			'supabaseStore.list() is not wired — use the layout load or call api.get("/api/recipe-tree") instead.'
		);
	},

	async get(_id: string): Promise<RecipeTree | null> {
		throw new Error('supabaseStore.get() is not wired — use the /recipes/[slug] load.');
	},

	async create(name: string): Promise<{ id: string }> {
		// /api/save reads `request.formData()`, not JSON. axios with a
		// URLSearchParams body sets Content-Type to
		// application/x-www-form-urlencoded automatically.
		const { data } = await api.post<{ id: string }>(
			'/api/save',
			new URLSearchParams({ recipeName: name })
		);
		return { id: data.id };
	},

	async rename(id: string, name: string): Promise<void> {
		await api.patch(`/api/recipe/${id}`, { name });
	},

	async fork(nodeId: string, name?: string): Promise<{ id: string }> {
		const { data } = await api.post<{ id: string }>(`/api/recipe/${nodeId}/fork`, {
			name: name ?? 'Forked'
		});
		return { id: data.id };
	},

	async remove(id: string): Promise<void> {
		await api.delete(`/api/recipe/${id}`);
	},

	async saveNode(nodeId: string, changes: NodeChanges): Promise<void> {
		await api.put(`/api/recipe-node/${nodeId}`, changes);
	}
};
