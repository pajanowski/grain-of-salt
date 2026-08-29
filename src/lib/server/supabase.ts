import { createServerClient } from '@supabase/ssr';
import type { CookieMethodsServer } from '@supabase/ssr';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { env as privEnv } from '$env/dynamic/private';

const SUPABASE_URL: string = env.PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY: string = env.PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	throw new Error(
		'PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY must be set in the environment'
	);
}

/**
 * Build a Supabase client scoped to a single SvelteKit request.
 *
 * The caller (hooks.server.ts) passes the request's cookies plus the
 * writable cookie API; getAll/setAll bridge those into the @supabase/ssr
 * contract. Any session mutation during the request (token refresh, sign-in)
 * is written back to the response cookies automatically.
 */
export function createRequestClient(event: RequestEvent) {
	return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		cookies: requestCookies(event)
	});
}

/**
 * Service-role client. Bypasses RLS and the user session entirely.
 * Server-only. Never import this from a .svelte file or any module that
 * ends up in the browser bundle.
 *
 * Use only for trusted server-side operations (admin tasks, background jobs).
 */
export function createServiceClient() {
	const serviceKey = privEnv.SUPABASE_SERVICE_ROLE_KEY;
	if (!serviceKey) {
		throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
	}
	return createServerClient(SUPABASE_URL, serviceKey, {
		cookies: {
			getAll: () => [],
			setAll: async () => {}
		}
	});
}

function requestCookies(event: RequestEvent): CookieMethodsServer {
	return {
		getAll: () => event.cookies.getAll(),
		setAll: async (cookies, headers) => {
			const isHttps = event.url.protocol === 'https:';
			for (const { name, value, options } of cookies) {
				event.cookies.set(name, value, {
					...options,
					path: '/',
					// SvelteKit defaults secure:true for any host other than
					// literal `localhost` on HTTP. That drops auth cookies in
					// containerized e2e tests (where the URL is host.docker.internal
					// or some other non-localhost hostname). Force secure:false
					// on HTTP unless we're behind a real HTTPS proxy.
					secure: isHttps && options?.secure !== false
				});
			}
		}
	};
}
