import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';

/**
 * Gate a server load/action: requires a Supabase-authenticated user.
 *
 * Usage:
 *   const user = await requireUser(event);
 *
 * On failure: 303 redirect to /auth?next=<current path>.
 */
export async function requireUser(event: RequestEvent): Promise<User> {
	const { user } = await event.locals.safeGetSession();
	if (!user) {
		const next = encodeURIComponent(event.url.pathname + event.url.search);
		throw redirect(303, `/auth?next=${next}`);
	}
	return user;
}
