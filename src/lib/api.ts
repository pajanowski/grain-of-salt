/**
 * Shared HTTP client for browser → /api/* calls.
 *
 * Why a wrapper instead of bare axios? Two reasons:
 *  - Same-origin only. We never call third-party URLs from these
 *    components, so an empty baseURL keeps call sites terse (`api.put(...)`
 *    rather than `api.put('/api/...')`).
 *  - Error semantics. The previous fetch code threw on `!res.ok` in some
 *    places and silently returned in others. This client treats every
 *    non-2xx response as a thrown `AxiosError` with `error.response.data`
 *    holding the server's plain-text body, so callers can show it
 *    directly.
 */
import axios, { type AxiosError } from 'axios';

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
 * Save ingredient and direction changes for a recipe node.
 */
export async function saveRecipeNode(
	nodeId: string,
	ingredientChanges: unknown[],
	directionChanges: unknown[]
): Promise<void> {
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
	const res = await api.patch<{ isFavorite: boolean }>(`/mise/api/recipe-node/${nodeId}/favorite`);
	return res.data?.isFavorite ?? false;
}

/**
 * Update public/private visibility for a recipe node.
 */
export async function setRecipeNodePublic(nodeId: string, isPublic: boolean): Promise<void> {
	await api.patch(`/mise/api/recipe-node/${nodeId}/public`, { isPublic });
}

/**
 * Rename a recipe tree root.
 */
export async function renameRecipe(rootNodeId: string, name: string): Promise<void> {
	await api.patch(`/mise/api/recipe/${rootNodeId}`, { name });
}

/**
 * Fork a recipe node to create a child revision.
 */
export async function forkRecipe(nodeId: string, name: string): Promise<{ id: string }> {
	const res = await api.post<{ id: string }>(`/mise/api/recipe/${nodeId}/fork`, { name });
	return res.data;
}
