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
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import postgres from 'postgres';
import axios from 'axios';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { v4 as uuidv4 } from 'uuid';

export { TEST_USER_ID, TEST_USER_EMAIL } from './helpers/auth-shared';
import { TEST_USER_ID, TEST_USER_EMAIL } from './helpers/auth-shared';
import {
  DEMO_USER_ID,
  SEED_COMMUNITY_USER_ID
} from '../../src/lib/server/db/schema';

/**
 * Cached Supabase auth cookies shared across every test in the suite.
 * Captured directly via Supabase Auth API at the end of globalSetup;
 * consumed by the chromium project via `use.storageState` so individual
 * tests boot already signed in instantly.
 */
const STORAGE_STATE_PATH = '.auth/test-user.json';
const TEST_PASSWORD = 'e2e-test-password-12345';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function verifyServicesReady(dbUrl: string, supabaseUrl: string) {
  try {
    const testClient = postgres(dbUrl, { connect_timeout: 2, max: 1 });
    await testClient`select 1`;
    await testClient.end();
  } catch {
    console.log('[e2e global-setup] Database not responding, attempting to start Supabase services...');
    try {
      execSync('pnpm db:start', { stdio: 'inherit' });
    } catch {
      throw new Error(
        `Failed to connect to database at ${dbUrl} and unable to start Supabase services automatically. Please ensure Supabase is running with 'pnpm db:start' or 'just setup-dev'.`
      );
    }
  }

  try {
    await axios.get(`${supabaseUrl}/auth/v1/health`, { timeout: 3000 });
  } catch {
    try {
      await axios.get(`${supabaseUrl}/`, { timeout: 3000 });
    } catch {
      console.warn(`[e2e global-setup] Warning: Supabase endpoint ${supabaseUrl} did not respond promptly.`);
    }
  }
}

async function ensureUser(
  db: ReturnType<typeof drizzle>,
  id: string,
  email: string,
  displayName: string
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
			crypt(${TEST_PASSWORD}, gen_salt('bf')),
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
		on conflict (id) do update set
			encrypted_password = crypt(${TEST_PASSWORD}, gen_salt('bf')),
			email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
			raw_user_meta_data = ${`{"display_name":"${displayName}"}`}::jsonb
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
  testOwnerId: string
) {
  const demoRows = await db.execute<{
    id: string;
    parent_id: string | null;
    name: string;
    ingredient_changes: unknown;
    direction_changes: unknown;
  }>(sql`
		select id, parent_id, name, ingredient_changes, direction_changes
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
				name, ingredient_changes, direction_changes
			) values (
				${newId}::uuid,
				${row.parent_id ? (oldToNew.get(row.parent_id) ?? null) : null}::uuid,
				${testOwnerId}::uuid,
				${row.name},
				${sql.raw(`'${JSON.stringify(row.ingredient_changes).replace(/'/g, "''")}'::jsonb`)},
				${sql.raw(`'${JSON.stringify(row.direction_changes).replace(/'/g, "''")}'::jsonb`)}
			)
		`);
  }
}

async function captureTestUserStorageStateDirectly(supabaseUrl: string, anonKey: string) {
  const tokenUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  const response = await axios.post(
    tokenUrl,
    {
      email: TEST_USER_EMAIL,
      password: TEST_PASSWORD
    },
    {
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json'
      }
    }
  );

  const session = response.data;
  const sessionStr = JSON.stringify(session);
  const base64Session = `base64-${Buffer.from(sessionStr).toString('base64')}`;

  const expires = session.expires_at ? Number(session.expires_at) + 86400 * 365 : Math.floor(Date.now() / 1000) + 86400 * 365;

  const cookies = [
    {
      name: 'sb-127-auth-token',
      value: base64Session,
      domain: 'localhost',
      path: '/',
      expires,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const
    },
    {
      name: 'sb-localhost-auth-token',
      value: base64Session,
      domain: 'localhost',
      path: '/',
      expires,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const
    },
    {
      name: 'sb-127-auth-token',
      value: base64Session,
      domain: '127.0.0.1',
      path: '/',
      expires,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const
    },
    {
      name: 'sb-localhost-auth-token',
      value: base64Session,
      domain: '127.0.0.1',
      path: '/',
      expires,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const
    }
  ];

  const storageState = {
    cookies,
    origins: []
  };

  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2));
}

export default async function globalSetup() {
  const dbUrl = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54322/postgres';
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY ?? DEFAULT_SUPABASE_ANON_KEY;

  console.log('[e2e global-setup] Checking service readiness');
  await verifyServicesReady(dbUrl, supabaseUrl);

  const client = postgres(dbUrl, { prepare: false });
  const db = drizzle(client);

  try {
    console.log('[e2e global-setup] Provisioning demo + test users');
    await ensureUser(
      db,
      DEMO_USER_ID,
      'demo@grain-of-salt.local',
      'Demo User'
    );
    await ensureUser(
      db,
      SEED_COMMUNITY_USER_ID,
      'auguste@grain-of-salt.local',
      'Chef Auguste'
    );
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

  console.log('[e2e global-setup] Generating shared test-user storage state directly via Supabase Auth');
  await captureTestUserStorageStateDirectly(supabaseUrl, anonKey);
}
