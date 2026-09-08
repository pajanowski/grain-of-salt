import type { PageServerLoad, Actions } from './$types';
import { requireUser } from '$lib/server/auth-guard';
import { getProfile, upsertProfile } from '$lib/server/profiles';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const user = await requireUser(event);
	const profile = await getProfile(user.id);

	const roots = await db
		.select()
		.from(recipeNodes)
		.where(eq(recipeNodes.ownerId, user.id));

	return {
		userEmail: user.email,
		userId: user.id,
		createdAt: user.created_at,
		displayName: profile?.displayName ?? null,
		recipeCount: roots.length
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = await requireUser({ locals } as Parameters<typeof requireUser>[0]);
		const formData = await request.formData();
		const displayName = formData.get('displayName');
		if (typeof displayName !== 'string') {
			return fail(400, { error: 'displayName is required' });
		}
		await upsertProfile(user.id, displayName.trim());
		return { success: true };
	}
};
