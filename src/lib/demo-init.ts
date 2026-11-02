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
 * Returns the URL for jumping into demo mode from any origin or current URL.
 */
export function getDemoUrl(currentUrl: URL | Location | { hostname: string; protocol?: string; port?: string }): string {
	const hostname = currentUrl.hostname || '';
	const protocol = currentUrl.protocol || 'http:';
	const port = currentUrl.port ? `:${currentUrl.port}` : '';

	if (isDemoHost(hostname)) {
		return '/mise';
	}

	if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
		return `${protocol}//demo.localhost${port}/mise`;
	}

	if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
		return `${protocol}//demo.localhost${port}/mise`;
	}

	const parts = hostname.split('.');
	if (parts.length > 2) {
		parts[0] = 'demo';
		return `${protocol}//${parts.join('.')}${port}/mise`;
	}

	if (parts.length === 2) {
		return `${protocol}//demo.${hostname}${port}/mise`;
	}

	return `${protocol}//demo.${hostname}${port}/mise`;
}

/**
 * Client-side detection flag.
 */
export const isDemoMode =
	typeof window !== 'undefined' &&
	(isDemoHost(window.location.hostname) ||
		import.meta.env.VITE_DEMO_MODE === '1' ||
		import.meta.env.VITE_DEMO_MODE === 'true');
