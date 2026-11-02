import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const demoMode = Boolean((locals as any).demoMode);
	const { session, user } = await locals.safeGetSession();

	return {
		demoMode,
		session,
		user
	};
};
