/**
 * Shared API and Store Dispatch client.
 *
 * Automatically dispatches to demoStore when client is in Demo Mode
 * (hostname starting with demo. or VITE_DEMO_MODE=1), or sends HTTP requests
 * to the backend in standard mode.
 */
import axios, { type AxiosError } from 'axios';
import { isDemoMode } from './demo-init';
import { demoStore } from './recipe-store.demo';
import type { IngredientChange, DirectionChange } from './obj/RecipeNode.svelte';

export const api = axios.create({
	baseURL: '',
	withCredentials: true
});

/** Extract the server's plain-text error body for surfacing in alerts. */
export function errorMessage(e: unknown, fallback = 'Request failed'): string {
	if (axios.isAxiosError(e)) {
		const ax = e as AxiosError;
		const data = ax.response?.data;
		if (typeof data === 'string' && data.length > 0) return data;
		if (data && typeof data === 'object') {
			const m = Reflect.get(data, 'message');
			if (typeof m === 'string') return m;
		}
		return `${ax.response?.status ?? ''} ${ax.message}`.trim();
	}
	return e instanceof Error ? e.message : fallback;
}

/**
 * Create a new root recipe.
 */
export async function createRecipe(name: string): Promise<{ id: string }> {
	if (isDemoMode) {
		return await demoStore.create(name);
	}
	const form = new URLSearchParams({ recipeName: name });
	const res = await api.post<{ id: string }>('/mise/api/save', form);
	return res.data;
}

/**
 * Save ingredient and direction changes for a recipe node.
 */
export async function saveRecipeNode(
	nodeId: string,
	ingredientChanges: unknown[],
	directionChanges: unknown[]
): Promise<void> {
	if (isDemoMode) {
		await demoStore.saveNode(
			nodeId,
			ingredientChanges as IngredientChange[],
			directionChanges as DirectionChange[]
		);
		return;
	}
	await api.put(`/mise/api/recipe-node/${nodeId}`, {
		nodeId,
		ingredientChanges,
		directionChanges
	});
}

/**
 * Toggle favorite bookmark status for a recipe node.
 * Returns the updated `isFavorite` state from the server.
 */
export async function toggleRecipeFavorite(nodeId: string): Promise<boolean> {
	if (isDemoMode) {
		return await demoStore.toggleFavorite(nodeId);
	}
	const res = await api.patch<{ isFavorite: boolean }>(`/mise/api/recipe-node/${nodeId}/favorite`);
	return res.data?.isFavorite ?? false;
}

/**
 * Update public/private visibility for a recipe node.
 */
export async function setRecipeNodePublic(nodeId: string, isPublic: boolean): Promise<void> {
	if (isDemoMode) {
		await demoStore.setPublic(nodeId, isPublic);
		return;
	}
	await api.patch(`/mise/api/recipe-node/${nodeId}/public`, { isPublic });
}

/**
 * Rename a recipe tree root.
 */
export async function renameRecipe(rootNodeId: string, name: string): Promise<void> {
	if (isDemoMode) {
		await demoStore.rename(rootNodeId, name);
		return;
	}
	await api.patch(`/mise/api/recipe/${rootNodeId}`, { name });
}

/**
 * Fork a recipe node to create a child revision.
 */
export async function forkRecipe(nodeId: string, name: string): Promise<{ id: string }> {
	if (isDemoMode) {
		return await demoStore.fork(nodeId, name);
	}
	const res = await api.post<{ id: string }>(`/mise/api/recipe/${nodeId}/fork`, { name });
	return res.data;
}

/**
 * Delete a recipe and its entire descendant lineage tree.
 */
export async function deleteRecipe(rootNodeId: string): Promise<void> {
	if (isDemoMode) {
		await demoStore.remove(rootNodeId);
		return;
	}
	await api.delete(`/mise/api/recipe/${rootNodeId}`);
}
