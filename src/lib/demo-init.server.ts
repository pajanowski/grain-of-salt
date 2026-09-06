/**
 * Server-only demo detection (ADR 0003 — Detection).
 *
 * This module imports $env/dynamic/private so it must NEVER be imported
 * from client-side code. The public env var gives the server a stable
 * signal that survives across deploys without rebuilding the client JS.
 *
 * The client-safe helpers (isDemoHost, isDemoMode) live in demo-init.ts.
 */
import { env } from '$env/dynamic/private';
import { isDemoHost } from './demo-init';

/**
 * Server-side demo check. SSR uses the hostname OR an explicit env
 * flag set by the deployer.
 */
export function isDemoServer(
	hostname: string,
	envFlag: string | undefined | null
): boolean {
	const flag = env.VITE_DEMO_MODE ?? envFlag;
	return isDemoHost(hostname) || flag === '1';
}
