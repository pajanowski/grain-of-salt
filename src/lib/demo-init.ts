/**
 * Detection helpers for client-side and server-side demo mode.
 * As defined in ADR 0003, demo mode activates if the hostname starts with `demo.`
 * or if the VITE_DEMO_MODE environment variable is set.
 */

export function isDemoHost(hostname: string): boolean {
	if (!hostname) return false;
	const clean = hostname.toLowerCase().split(':')[0];
	return clean.startsWith('demo.') || clean === 'demo.local' || clean === 'demo.localhost';
}

/**
 * Client-side detection flag.
 */
export const isDemoMode =
	typeof window !== 'undefined' &&
	(isDemoHost(window.location.hostname) ||
		import.meta.env.VITE_DEMO_MODE === '1' ||
		import.meta.env.VITE_DEMO_MODE === 'true');
