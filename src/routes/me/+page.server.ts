import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth-guard';

export const load: PageServerLoad = async (event) => {
	const user = await requireUser(event);
	return {
		userEmail: user.email,
		userId: user.id,
		createdAt: user.created_at
	};
};
