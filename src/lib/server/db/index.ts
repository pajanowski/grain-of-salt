import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

/**
 * Application-side Postgres connection.
 *
 * On Supabase local, this connection string points at the bundled Postgres
 * container's superuser (`postgres`). Superusers bypass RLS, so the bo
 * layer is solely responsible for ownership checks.
 *
 * Authorization rules:
 *   - Every `recipe_nodes` write MUST carry an ownerId matching
 *     `locals.user.id` (or DEMO_USER_ID for guests — which is read-only
 *     in practice).
 *   - Every `recipe_nodes` read MUST filter by ownerId unless it is the
 *     demo-user tree (guests) or the owner themselves.
 *
 * Browser-side Supabase traffic (auth, realtime) goes through
 * `getBrowserSupabase()` using the anon key and IS subject to RLS — so
 * RLS still defends against direct PostgREST access.
 */
const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });
