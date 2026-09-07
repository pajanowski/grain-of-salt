import { db } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { SelectProfile } from '$lib/server/db/schema';

export async function getProfile(userId: string): Promise<SelectProfile | null> {
	const rows = await db
		.select()
		.from(profiles)
		.where(eq(profiles.id, userId))
		.limit(1);
	return rows[0] ?? null;
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
