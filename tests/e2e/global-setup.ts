/**
 * Playwright global setup:
 *   1. Provision the demo user and the test user in auth.users.
 *   2. Seed the database.
 *   3. Clone every seeded recipe under TEST_USER_ID so tests (which sign
 *      in as the test user) see a populated recipe tree.
 *
 * The DATABASE_URL env var is supplied by the docker runner; do NOT load
 * it from .env inside this script — .env points at 127.0.0.1 which
 * resolves to the container itself, not the host.
 */
import { execSync } from 'node:child_process';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { v4 as uuidv4 } from 'uuid';

export { TEST_USER_ID, TEST_USER_EMAIL } from './helpers/auth-shared';
import { TEST_USER_ID, TEST_USER_EMAIL } from './helpers/auth-shared';

async function ensureUser(
	db: ReturnType<typeof drizzle>,
	id: string,
	email: string,
	displayName: string,
) {
	await db.execute(sql`
		insert into auth.users (
			instance_id, id, aud, role, email,
			encrypted_password, email_confirmed_at,
			raw_app_meta_data, raw_user_meta_data,
			created_at, updated_at, confirmation_token,
			email_change, email_change_token_new, recovery_token
		)
		values (
			'00000000-0000-0000-0000-000000000000',
			${id}::uuid,
			'authenticated',
			'authenticated',
			${email},
			crypt('test-password-not-used', gen_salt('bf')),
			now(),
			'{"provider":"email","providers":["email"]}'::jsonb,
			${`{"display_name":"${displayName}"}`}::jsonb,
			now(),
			now(),
			'',
			'',
			'',
			''
		)
		on conflict (id) do nothing
	`);
}

/**
 * For each recipe currently owned by DEMO_USER_ID, clone its entire chain
 * under TEST_USER_ID with fresh node ids (so RLS scopes correctly and test
 * mutations don't trample the demo tree).
 *
 * parentNodeId is dropped on clones — each clone is a top-level recipe,
 * matching what a real fresh user would see after creating recipes.
 */
async function cloneDemoRecipesToTestUser(
	db: ReturnType<typeof drizzle>,
	demoOwnerId: string,
	testOwnerId: string,
) {
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
		where owner_id = ${demoOwnerId}::uuid
		order by timestamp asc
	`);

	const oldToNew = new Map<string, string>();
	for (const row of demoRows) {
		const newId = uuidv4();
		oldToNew.set(row.id, newId);
		await db.execute(sql`
			insert into public.recipe_nodes (
				id, parent_id, parent_node_id, owner_id,
				name, label, ingredient_changes, direction_changes
			) values (
				${newId}::uuid,
				${row.parent_id ? oldToNew.get(row.parent_id) ?? null : null}::uuid,
				null,
				${testOwnerId}::uuid,
				${row.name},
				${row.label},
				${sql.raw(`'${JSON.stringify(row.ingredient_changes).replace(/'/g, "''")}'::jsonb`)},
				${sql.raw(`'${JSON.stringify(row.direction_changes).replace(/'/g, "''")}'::jsonb`)}
			)
		`);
	}
}

export default async function globalSetup() {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) {
		throw new Error('DATABASE_URL must be set for e2e tests to run');
	}

	const client = postgres(dbUrl, { prepare: false });
	const db = drizzle(client);

	try {
		console.log('[e2e global-setup] Provisioning demo + test users');
		await ensureUser(db, '00000000-0000-0000-0000-000000000001', 'demo@grain-of-salt.local', 'Demo User');
		await ensureUser(db, TEST_USER_ID, TEST_USER_EMAIL, 'Test User');

		console.log('[e2e global-setup] Re-seeding database from scripts/seed.ts');
		execSync('node node_modules/tsx/dist/cli.mjs scripts/seed.ts', {
			stdio: 'inherit',
			env: { ...process.env, DATABASE_URL: dbUrl }
		});

		console.log('[e2e global-setup] Cloning demo recipes under test user');
		await cloneDemoRecipesToTestUser(db, '00000000-0000-0000-0000-000000000001', TEST_USER_ID);
	} finally {
		await client.end();
	}
}
