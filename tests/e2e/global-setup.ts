/**
 * Playwright global setup: re-seed the database before the suite runs so
 * every test starts from a known state. The seed script is idempotent — it
 * deletes every recipe and node before inserting the seed data.
 *
 * Run via:
 *   playwright: { globalSetup: require.resolve('./tests/e2e/global-setup') }
 */
import { execSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';

/**
 * Load .env from the project root so we have the DATABASE_URL when
 * running outside the SvelteKit runtime (Playwright global setup runs
 * in plain Node).
 */
loadEnv({ path: `${process.cwd()}/.env` });

export default async function globalSetup() {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) {
		throw new Error('DATABASE_URL must be set for e2e tests to run');
	}

	console.log('[e2e global-setup] Re-seeding database from scripts/seed.ts');
	execSync('pnpm db:seed', {
		stdio: 'inherit',
		env: { ...process.env, DATABASE_URL: dbUrl }
	});
}
