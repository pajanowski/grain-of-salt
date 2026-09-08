import type { RequestHandler } from './$types';
import { seedForUser } from '$lib/server/seed-data';

export const POST: RequestHandler = async ({ locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) {
		return new Response('Sign in first', { status: 401 });
	}

	try {
		await seedForUser(ownerId);
		return new Response(JSON.stringify({ ok: true }), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err) {
		console.error('[/mise/api/seed] seed failed:', err);
		return new Response(JSON.stringify({ ok: false, error: 'Seed failed' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
