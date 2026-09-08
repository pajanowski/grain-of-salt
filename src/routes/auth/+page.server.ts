import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env } from '$env/dynamic/public';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();
	if (session && user) {
		// Already logged in — bounce home.
		throw redirect(303, url.searchParams.get('next') ?? '/mise');
	}
	return { supabaseConfigured: Boolean(env.PUBLIC_SUPABASE_URL), isLocal: /localhost|127\.0\.0\.1/.test(env.PUBLIC_SUPABASE_URL ?? '') };
};

export const actions: Actions = {
	/**
	 * Step 1: send a one-time code to the supplied email.
	 * `shouldCreateUser: true` lets new emails sign up on the same call
	 * (Supabase creates the auth.users row when they verify the code).
	 */
	otpRequest: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = (form.get('email') as string | null)?.trim().toLowerCase();
		if (!email || !email.includes('@')) {
			return fail(400, { step: 'request', email, error: 'Enter a valid email address.' });
		}

		const { error } = await locals.supabase.auth.signInWithOtp({
			email,
			options: {
				shouldCreateUser: true,
				// Computed from the request so the magic-link redirect targets
				// the deployed origin, not whatever Supabase's project
				// `site_url` happens to be set to. Supabase still requires
				// this origin be present in Auth → URL Configuration →
				// Additional Redirect URLs on the hosted project.
			emailRedirectTo: `${url.origin}/auth`
			}
		});

		if (error) {
			return fail(400, { step: 'request', email, error: error.message });
		}

		return { step: 'verify', email, sent: true };
	},

	/**
	 * Step 2: trade the 8-digit code for a session. On success Supabase
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

		throw redirect(303, url.searchParams.get('next') ?? '/mise');
	},

	/**
	 * Sign out. Clears the Supabase session.
	 */
	logout: async ({ locals }) => {
		await locals.supabase.auth.signOut();
		throw redirect(303, '/');
	}
};
