import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';

/**
 * Gate a server load/action: requires a real (non-guest) Supabase user.
 *
 * Usage:
 *   const user = await requireUser(event);
 *
 * On failure: 303 redirect to /auth?next=<current path>.
 *
 * Note: this only validates "real" users. If you want to allow guests but
 * block anonymous browsers, check `event.locals.session` instead.
 */
export async function requireUser(event: RequestEvent): Promise<User> {
	const { user } = await event.locals.safeGetSession();
	if (!user) {
		const next = encodeURIComponent(event.url.pathname + event.url.search);
		throw redirect(303, `/auth?next=${next}`);
	}
	return user;
}
