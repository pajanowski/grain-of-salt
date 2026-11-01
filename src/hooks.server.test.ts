import { describe, it, expect } from 'vitest';
import { isServerDemoMode, supabaseHandle, authGuardHandle } from './hooks.server';
import { DEMO_USER_ID } from '$lib/demo-seed';

describe('hooks.server demo mode', () => {
	it('identifies demo mode from demo subdomain (demo.grainofsalt.app)', () => {
		const demoUrl = new URL('http://demo.grainofsalt.app/mise');
		expect(isServerDemoMode(demoUrl)).toBe(true);

		const demoLocalUrl = new URL('http://demo.local:5173/mise');
		expect(isServerDemoMode(demoLocalUrl)).toBe(true);

		const prodUrl = new URL('http://grainofsalt.app/mise');
		expect(isServerDemoMode(prodUrl)).toBe(false);

		const appUrl = new URL('http://app.grainofsalt.app/mise');
		expect(isServerDemoMode(appUrl)).toBe(false);
	});

	it('injects stub supabase and synthetic session in demo mode handle', async () => {
		const event: any = {
			url: new URL('http://demo.grainofsalt.app/mise'),
			locals: {}
		};

		const resolve = async (evt: any) => {
			return new Response('ok');
		};

		await supabaseHandle({ event, resolve });
		await authGuardHandle({ event, resolve });

		expect(event.locals.demoMode).toBe(true);
		expect(event.locals.supabase).toBeDefined();

		const { session, user } = await event.locals.safeGetSession();
		expect(session).toBeDefined();
		expect(user?.id).toBe(DEMO_USER_ID);
		expect(event.locals.user?.id).toBe(DEMO_USER_ID);
	});
});
