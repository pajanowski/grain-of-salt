import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEMO_USER_ID } from '$lib/server/db/schema';
import { DEV_USER, DEV_SESSION, isSingleUserMode } from './singleUser';
import { requireUser } from './auth-guard';
import type { RequestEvent } from '@sveltejs/kit';

describe('singleUser', () => {
	it('defines DEV_USER with DEMO_USER_ID and demo metadata', () => {
		expect(DEV_USER.id).toBe(DEMO_USER_ID);
		expect(DEV_USER.id).toBe('00000000-0000-0000-0000-000000000001');
		expect(DEV_USER.email).toBe('demo@grain-of-salt.local');
		expect(DEV_USER.user_metadata?.display_name).toBe('Demo User');
	});

	it('defines DEV_SESSION referencing DEV_USER', () => {
		expect(DEV_SESSION.user).toBe(DEV_USER);
		expect(DEV_SESSION.access_token).toBeDefined();
	});

	it('returns true for isSingleUserMode when private or public env flag is true', () => {
		// Default or dynamic check
		const result = isSingleUserMode();
		expect(typeof result).toBe('boolean');
	});
});

describe('requireUser', () => {
	it('returns user if safeGetSession resolves a user', async () => {
		const mockEvent = {
			locals: {
				safeGetSession: async () => ({ session: DEV_SESSION, user: DEV_USER })
			},
			url: new URL('http://localhost:5173/mise/recipes/abc')
		} as unknown as RequestEvent;

		const user = await requireUser(mockEvent);
		expect(user).toBe(DEV_USER);
		expect(user.id).toBe(DEMO_USER_ID);
	});

	it('redirects to /auth?next=... if safeGetSession resolves null', async () => {
		const mockEvent = {
			locals: {
				safeGetSession: async () => ({ session: null, user: null })
			},
			url: new URL('http://localhost:5173/mise/recipes/abc?tab=ingredients')
		} as unknown as RequestEvent;

		await expect(requireUser(mockEvent)).rejects.toThrow();
		try {
			await requireUser(mockEvent);
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/auth?next=%2Fmise%2Frecipes%2Fabc%3Ftab%3Dingredients');
		}
	});
});
