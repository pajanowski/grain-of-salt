import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createRequestClient } from '$lib/server/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { DEV_SESSION, DEV_USER, isSingleUserMode } from '$lib/server/singleUser';
import { isDemoHost } from '$lib/demo-init';
import { makeStubSupabase } from '$lib/supabase-stub';

export function isServerDemoMode(url: URL): boolean {
	const val =
		privateEnv.VITE_DEMO_MODE ??
		publicEnv.PUBLIC_DEMO_MODE ??
		(typeof process !== 'undefined' ? process.env.VITE_DEMO_MODE : undefined);
	return isDemoHost(url.hostname) || val === '1' || val === 'true';
}

/**
 * Per-request Supabase client. Refreshes the session if needed and exposes
 * the resulting user on event.locals.
 */
export const supabaseHandle: Handle = async ({ event, resolve }) => {
	if (isServerDemoMode(event.url)) {
		event.locals.supabase = makeStubSupabase();
		(event.locals as any).demoMode = true;
		event.locals.safeGetSession = async () => ({
			session: DEV_SESSION,
			user: DEV_USER
		});
		return resolve(event, {
			filterSerializedResponseHeaders(name) {
				return name === 'content-range' || name === 'x-supabase-api-version';
			}
		});
	}

	event.locals.supabase = createRequestClient(event);

	// Skip Supabase entirely if env isn't configured (e.g. before first run).
	if (!publicEnv.PUBLIC_SUPABASE_URL) {
		event.locals.safeGetSession = async () => {
			if (isSingleUserMode()) {
				return { session: DEV_SESSION, user: DEV_USER };
			}
			return { session: null, user: null };
		};
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
			if (isSingleUserMode()) {
				return { session: DEV_SESSION, user: DEV_USER };
			}
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error) {
			if (isSingleUserMode()) {
				return { session: DEV_SESSION, user: DEV_USER };
			}
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
 * skip a second Supabase call.
 */
export const authGuardHandle: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;
	return resolve(event);
};

export const handle: Handle = sequence(supabaseHandle, authGuardHandle);
