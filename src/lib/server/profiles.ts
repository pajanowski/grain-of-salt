import { db } from '$lib/server/db';
import { profiles, DEMO_USER_ID } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { SelectProfile } from '$lib/server/db/schema';

export async function getProfile(userId: string): Promise<SelectProfile | null> {
	const rows = await db
		.select()
		.from(profiles)
		.where(eq(profiles.id, userId))
		.limit(1);
	if (rows[0]) return rows[0];

	if (userId === DEMO_USER_ID) {
		await db
			.insert(profiles)
			.values({ id: DEMO_USER_ID, displayName: 'Demo User' })
			.onConflictDoNothing();
		const created = await db
			.select()
			.from(profiles)
			.where(eq(profiles.id, userId))
			.limit(1);
		return created[0] ?? null;
	}

	return null;
}

export async function upsertProfile(userId: string, displayName: string): Promise<void> {
	await db
		.insert(profiles)
		.values({ id: userId, displayName })
		.onConflictDoUpdate({
			target: profiles.id,
			set: { displayName, updatedAt: new Date() }
		});
}
