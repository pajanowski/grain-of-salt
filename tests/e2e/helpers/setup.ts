/**
 * Per-test DB reset: clears the test user's recipes, runs the seed
 * (which repopulates DEMO_USER_ID), then clones the demo tree under the
 * test user. Used by every e2e test's `beforeEach`.
 *
 * The DATABASE_URL env var is supplied by the docker runner; do NOT load
 * it from .env inside this script — the .env file points at 127.0.0.1
 * which resolves to the container itself, not the host.
 */
import { execSync } from 'node:child_process';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';




import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

import { TEST_USER_ID } from '../global-setup';

export async function resetTestUserRecipes() {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) throw new Error('DATABASE_URL must be set for e2e tests to run');

	// 1. Run the seed: this clears recipe_nodes and repopulates under
	//    DEMO_USER_ID.
	execSync('node node_modules/tsx/dist/cli.mjs scripts/seed.ts', {
		stdio: 'inherit',
		env: { ...process.env, DATABASE_URL: dbUrl }
	});

	// 2. Clone demo recipes under TEST_USER_ID.
	const client = postgres(dbUrl, { prepare: false });
	const db = drizzle(client);
	try {
		const demoRows = await db.execute<{
			id: string;
			parent_id: string | null;
			name: string;
			label: string | null;
			ingredient_changes: unknown;
			direction_changes: unknown;
		}>(sql`
			select id, parent_id, name, label, ingredient_changes, direction_changes
			from public.recipe_nodes
			where owner_id = '00000000-0000-0000-0000-000000000001'::uuid
			order by timestamp asc
		`);

		const oldToNew = new Map<string, string>();
		for (const row of demoRows) {
			const newId = uuidv4();
			oldToNew.set(row.id, newId);
			await db.execute(sql`
				insert into public.recipe_nodes (
					id, parent_id, owner_id,
					name, label, ingredient_changes, direction_changes
				) values (
			`);
		}
	} finally {
		await client.end();
	}
}
