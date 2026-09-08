import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth-guard';

export const load: PageServerLoad = async (event) => {
	await requireUser(event);
	throw redirect(303, `/mise/me`);
};
