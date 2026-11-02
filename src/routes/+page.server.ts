import type { PageServerLoad } from './$types';
import { getDemoUrl } from '$lib/demo-init';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	return {
		signedIn: Boolean(user),
		demoUrl: getDemoUrl(url)
	};
};
