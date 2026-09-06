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
