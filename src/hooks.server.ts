import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createRequestClient } from '$lib/server/supabase';
import { makeStubSupabase } from '$lib/supabase-stub';
import { DEMO_USER } from '$lib/demo-seed';
import { isDemoServer } from '$lib/demo-init';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

/**
 * Per-request Supabase client. Refreshes the session if needed and exposes
 * the resulting user on event.locals. Routes that need to verify the user
 * against the auth server (e.g. before serving sensitive data) call
 * `safeGetSession()` rather than trusting `event.locals.user` alone —
 * the cookie can be stale until we round-trip to Supabase.
 */
const supabase: Handle = async ({ event, resolve }) => {
	// Default demoMode=false; demo branch sets true below.
	event.locals.demoMode = false;
	// Demo mode (ADR 0003 — SSR). The host is `demo.*` so we install a
	// no-op Supabase client and a fake DEMO_USER session.
	const demoEnv =
		(import.meta as { env?: Record<string, string> }).env?.VITE_DEMO_MODE ?? env.VITE_DEMO_MODE;
	if (isDemoServer(event.url.hostname, demoEnv)) {
		event.locals.demoMode = true;
		event.locals.supabase = makeStubSupabase() as unknown as SupabaseClient;
		event.locals.safeGetSession = async (): Promise<{ session: Session | null; user: User | null }> => ({
			session: { user: DEMO_USER as User } as Session,
			user: DEMO_USER as User
		});
		return resolve(event, {
			filterSerializedResponseHeaders(name) {
				return name === 'content-range' || name === 'x-supabase-api-version';
			}
		});
	}

	event.locals.supabase = createRequestClient(event);

	// Skip Supabase entirely if env isn't configured (e.g. before first run).
	if (!env.PUBLIC_SUPABASE_URL) {
		event.locals.safeGetSession = async () => ({ session: null, user: null });
		return resolve(event, {
			filterSerializedResponseHeaders(name) {
				return name === 'content-range' || name === 'x-supabase-api-version';
			}
		});
	}

	event.locals.safeGetSession = async (): Promise<{ session: Session | null; user: User | null }> => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();

		if (!session) {
			return { session: null, user: null };
		}

		// Round-trip to Supabase to validate the JWT and refresh if needed.
		// getUser() throws if the token is invalid, which we don't want —
		// treat that as a logged-out state.
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

/**
 * Auth guard. Marks the session into locals so layout server loads can
 * skip a second Supabase call. Real authorization lives in the route
 * (via safeGetSession() + redirect).
 */
const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;
	return resolve(event);
};

export const handle: Handle = sequence(supabase, authGuard);
