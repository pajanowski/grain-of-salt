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
import { chromium } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import { signInAsTestUser } from './helpers/auth';
export { TEST_USER_ID, TEST_USER_EMAIL } from './helpers/auth-shared';
import { TEST_USER_ID, TEST_USER_EMAIL } from './helpers/auth-shared';

/**
 * Cached Supabase auth cookies shared across every test in the suite.
 * Captured once at the end of globalSetup; consumed by the chromium
 * project via `use.storageState` so individual tests boot already
 * signed in instead of paying ~3s per test for an OTP round-trip.
 *
 * The directory is project-ignored; tests never read it directly.
 */
const STORAGE_STATE_PATH = '.auth/test-user.json';


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
 * No cross-recipe pointers — each clone is a top-level recipe matching
 * what a real fresh user would see after creating recipes.
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
				id, parent_id, owner_id,
				name, label, ingredient_changes, direction_changes
			) values (
				${newId}::uuid,
				${row.parent_id ? (oldToNew.get(row.parent_id) ?? null) : null}::uuid,
				${testOwnerId}::uuid,
				${row.name},
				${row.label},
				${sql.raw(`'${JSON.stringify(row.ingredient_changes).replace(/'/g, "''")}'::jsonb`)},
				${sql.raw(`'${JSON.stringify(row.direction_changes).replace(/'/g, "''")}'::jsonb`)}
			)
		`);
	}
}

/**
 * Names of the recipe-edit fixture — a 4-node tree shared across the
 * recipe-edit-changes e2e file so it can verify cross-node isolation
 * without per-test resets. Tests in that file navigate by name, so the
 * names are stable; the loader deletes any prior rows with these names
 * before inserting to keep the suite re-runnable against a warm DB.
 */
const FIXTURE_NAMES = [
	'Test Root',
	'Test Sibling A',
	'Test Sibling B',
	'Test Grandchild'
] as const;

/**
 * Build a 4-node fixture for the test user:
 *
 *   Test Root
 *   ├── Test Sibling A   (3 ingredients + 3 directions as initial content)
 *   │   └── Test Grandchild
 *   └── Test Sibling B   (empty)
 *
 * Sibling A carries initial content so the edit/remove tests have rows
 * to target. The other three nodes start empty so isolation is
 * unambiguous.
 *
 * Idempotent: deletes any prior fixture rows under TEST_USER_ID before
 * inserting, so re-running the suite against a warm DB is safe.
 */
async function setupRecipeEditFixture(
	db: ReturnType<typeof drizzle>,
	testOwnerId: string
) {
	const nameList = `(${FIXTURE_NAMES.map((n) => `'${n.replace(/'/g, "''")}'`).join(',')})`;
	await db.execute(sql.raw(
		`delete from public.recipe_nodes where owner_id = '${testOwnerId}' and name in ${nameList}`
	));

	const rootId = uuidv4();
	const siblingAId = uuidv4();
	const siblingBId = uuidv4();
	const grandchildId = uuidv4();

	const eggId = uuidv4();
	const milkId = uuidv4();
	const saltId = uuidv4();
	const ingredientChanges = [
		{
			id: uuidv4(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { id: eggId, name: 'Eggs', amount: 3, unit: 'whole' }
		},
		{
			id: uuidv4(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { id: milkId, name: 'Milk', amount: 1, unit: 'cup' }
		},
		{
			id: uuidv4(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { id: saltId, name: 'Salt', amount: 1, unit: 'tsp' }
		}
	];

	const crackId = uuidv4();
	const whiskId = uuidv4();
	const heatId = uuidv4();
	const directionChanges = [
		{
			id: uuidv4(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { id: crackId, body: 'Crack the eggs' }
		},
		{
			id: uuidv4(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { id: whiskId, body: 'Whisk with milk' }
		},
		{
			id: uuidv4(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { id: heatId, body: 'Heat the pan' }
		}
	];

	const toJsonb = (value: unknown) =>
		sql.raw(`'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`);

	// Insertion order matters: children reference their parent ids.
	const inserts: Array<{
		id: string;
		parentId: string | null;
		name: string;
		ingredients: unknown;
		directions: unknown;
	}> = [
		{
			id: rootId,
			parentId: null,
			name: 'Test Root',
			ingredients: [],
			directions: []
		},
		{
			id: siblingAId,
			parentId: rootId,
			name: 'Test Sibling A',
			ingredients: ingredientChanges,
			directions: directionChanges
		},
		{
			id: siblingBId,
			parentId: rootId,
			name: 'Test Sibling B',
			ingredients: [],
			directions: []
		},
		{
			id: grandchildId,
			parentId: siblingAId,
			name: 'Test Grandchild',
			ingredients: [],
			directions: []
		}
	];

	for (const row of inserts) {
		await db.execute(sql`
			insert into public.recipe_nodes (
				id, parent_id, owner_id,
				name, label, ingredient_changes, direction_changes
			) values (
				${row.id}::uuid,
				${row.parentId}::uuid,
				${testOwnerId}::uuid,
				${row.name},
				null,
				${toJsonb(row.ingredients)},
				${toJsonb(row.directions)}
			)
		`);
	}

	console.log('[e2e global-setup] Created 4-node recipe-edit fixture under test user');
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

		console.log('[e2e global-setup] Creating recipe-edit fixture under test user');
		await setupRecipeEditFixture(db, TEST_USER_ID);

	} finally {
		await client.end();
	}

	console.log('[e2e global-setup] Capturing shared test-user storage state');
	await captureTestUserStorageState();
}

/**
 * Launch a headless browser, sign in once as the test user, and persist
 * the resulting auth cookies + localStorage to disk. Playwright loads
 * this into every test's browser context via `use.storageState`, so
 * individual tests skip the OTP round-trip entirely.
 *
 * `baseURL` must match the value the tests use (see
 * playwright.config.ts); `signInAsTestUser` navigates to relative URLs.
 */
async function captureTestUserStorageState() {
	const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

	const browser = await chromium.launch();
	try {
		const context = await browser.newContext({ baseURL });
		const page = await context.newPage();
		await signInAsTestUser(page);
		await context.storageState({ path: STORAGE_STATE_PATH });
	} finally {
		await browser.close();
	}
}
