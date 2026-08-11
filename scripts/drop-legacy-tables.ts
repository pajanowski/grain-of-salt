/**
 * Drops the legacy `ingredients` and `directions` tables.
 *
 * Pre-requisites:
 *   1. `db:push` has been run with the new schema (no ingredients/directions).
 *   2. `db:migrate-to-nodes` has been run on every environment so no data is
 *      stranded in the legacy tables.
 *
 * Safe to re-run: it uses IF EXISTS.
 *
 *   pnpm db:drop-legacy-tables
 */
import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(DATABASE_URL);

async function drop() {
  console.log('🗑️  Dropping legacy ingredients and directions tables...');

  await client.unsafe('DROP TABLE IF EXISTS ingredients CASCADE;');
  await client.unsafe('DROP TABLE IF EXISTS directions CASCADE;');

  console.log('✅ Dropped legacy tables.');
}

drop()
  .catch((err) => {
    console.error('❌ Drop failed:', err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
