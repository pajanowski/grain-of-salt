import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();
	if (session && user) {
		// Already logged in — bounce home.
		throw redirect(303, url.searchParams.get('next') ?? '/');
	}
	return {};
};

export const actions: Actions = {
	/**
	 * Step 1: send a one-time code to the supplied email.
	 * `shouldCreateUser: true` lets new emails sign up on the same call
	 * (Supabase creates the auth.users row when they verify the code).
	 */
	otpRequest: async ({ request, locals }) => {
		const form = await request.formData();
		const email = (form.get('email') as string | null)?.trim().toLowerCase();
		if (!email || !email.includes('@')) {
			return fail(400, { step: 'request', email, error: 'Enter a valid email address.' });
		}

		const { error } = await locals.supabase.auth.signInWithOtp({
			email,
			options: {
				shouldCreateUser: true
			}
		});

		if (error) {
			return fail(400, { step: 'request', email, error: error.message });
		}

		return { step: 'verify', email, sent: true };
	},

	/**
	 * Step 2: trade the 6-digit code for a session. On success Supabase
	 * sets the auth cookies via the @supabase/ssr adapter wired in hooks.
	 */
	otpVerify: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = (form.get('email') as string | null)?.trim().toLowerCase();
		const token = (form.get('token') as string | null)?.trim();

		if (!email || !token) {
			return fail(400, { step: 'verify', email, error: 'Email and code are required.' });
		}

		const { error } = await locals.supabase.auth.verifyOtp({
			email,
			token,
			type: 'email'
		});

		if (error) {
			return fail(400, { step: 'verify', email, error: error.message });
		}

		throw redirect(303, url.searchParams.get('next') ?? '/');
	},

	/**
	 * Guest session. No Supabase call — just sets a cookie. Useful for
	 * demos and tests where you want to exercise the app shell without
	 * burning an email.
	 */
	guestIn: async ({ cookies, url }) => {
		cookies.set('guest', '1', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 60 * 24 // 1 day
		});
		throw redirect(303, url.searchParams.get('next') ?? '/');
	},

	/**
	 * Sign out. Clears the Supabase session and any guest cookie.
	 */
	logout: async ({ locals, cookies }) => {
		await locals.supabase.auth.signOut();
		cookies.delete('guest', { path: '/' });
		throw redirect(303, '/');
	},

	/**
	 * Upgrade a guest to a real email account. The user's guest data
	 * survives only if the route reading it falls back to the guest
	 * cookie; otherwise it's lost, since guest has no auth.users row.
	 * (This matches the "cookie-only guest" design choice.)
	 */
	guestClear: async ({ cookies, url }) => {
		cookies.delete('guest', { path: '/' });
		throw redirect(303, url.searchParams.get('next') ?? '/auth');
	}
};
