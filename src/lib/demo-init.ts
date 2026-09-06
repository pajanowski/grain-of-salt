/**
 * Demo-mode detection helpers (ADR 0003 — Detection).
 *
 * Both the server-side check (isDemoServer) and client-side check
 * (isDemoMode / isDemoHost) live here. This file has no server-only
 * imports and is safe to include in the browser bundle.
 *
 * The env-accessing isDemoServer is safe here because:
 *   - It is only ever called from .server.ts files (hooks, layout server)
 *     via the SvelteKit route resolver, which never ships those to the browser.
 *   - SvelteKit's route resolver maps `$lib/demo-init` to this file in server
 *     context and to this same file in client context.
 *   - On the client, isDemoMode (which calls isDemoHost) is the only entry-point
 *     used by recipes.ts, and isDemoServer is never called from client code.
 */

/**
 * Return true when the given hostname indicates the demo deployment.
 */
export function isDemoHost(hostname: string): boolean {
	if (!hostname) return false;
	if (hostname.startsWith('demo.')) return true;
	if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
	return false;
}

/**
 * Client-side demo check. Both signals must agree for this to return
 * true: the hostname must be a demo host AND the env flag must be
 * the literal string '1' (Vite env values are always strings).
 *
 * Defense in depth: a misconfigured env var on prod cannot silently
 * activate demo mode because the hostname check is also required.
 */
export function isDemoMode(
	windowLike: { location: { hostname: string } },
	envFlag: string | undefined | null
): boolean {
	const hostOk = isDemoHost(windowLike.location.hostname);
	const flagOk = envFlag === '1';
	return hostOk && flagOk;
}

/**
 * Server-side demo check. SSR uses the hostname OR an explicit env
 * flag set by the deployer. Only called from .server.ts files.
 */
export function isDemoServer(
	hostname: string,
	envFlag: string | undefined | null
): boolean {
	// VITE_DEMO_MODE is a Vite build variable — on the server it is
	// available via import.meta.env at build time. We fall back to the
	// caller's passed-in value so the function remains testable without Vite.
	const viteVal =
		typeof import.meta !== 'undefined'
			? (import.meta as { env?: Record<string, string> }).env?.VITE_DEMO_MODE
			: undefined;
	const flag = viteVal ?? envFlag;
	return isDemoHost(hostname) || flag === '1';
}
