import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const url = env.DATABASE_URL;
// Detect Supabase pooler URLs (`:6543` or `?pgbouncer=true`). Direct
// connections (port 5432) keep prepared statements safe; the pooler in
// transaction mode does not.
const isPooler = url.includes(':6543/') || url.includes('pgbouncer=true');

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
const client = postgres(url, {
	// pgBouncer in transaction mode rotates backend connections between
	// statements, so the prepare/execute split in the extended query
	// protocol lands on a backend that has no prepared statement and
	// surfaces as intermittent "Failed query" errors. Disable when
	// routing through the pooler; harmless on direct connections.
	prepare: !isPooler,
	// Cloudflare Workers spawn one isolate per concurrent request and
	// each isolate owns its own pool. Cap to stay under Supabase's
	// direct-connection limit (60 free tier, 200+ paid) when many
	// isolates are active simultaneously.
	max: 5,
	connection: {
		application_name: 'grain-of-salt-worker'
	},
	// (errors are caught and logged by the client.unsafe wrapper below).
	onnotice: () => {
		// Suppress routine Postgres NOTICE/NOTIFY messages from worker
		// logs. Remove this hook when debugging schema or trigger
		// activity.
	}
});

// Log the underlying postgres error on every failed query so the real
// cause (vs. Drizzle's "Failed query" wrapper) shows up in worker
// logs. postgres.js's `client.unsafe` returns a `PendingQuery<T>` that
// extends Promise AND carries extra methods (`.execute()`, `.values()`,
// `.raw()`, …) which Drizzle chains off of. Wrapping with `.catch()`
// returns a plain Promise and breaks that chain, so we register the
// logging as a side-effect handler and return the original PendingQuery
// untouched. The handler fires when the query rejects; the original
// rejection still propagates to Drizzle for its own wrapping.
type UnsafeFn = typeof client.unsafe;
const unsafe = client.unsafe.bind(client);
(client as unknown as { unsafe: UnsafeFn }).unsafe = ((...args: Parameters<UnsafeFn>) => {
	const result = unsafe(...args);
	result.catch((err: Error & { code?: string }) => {
		console.error('[db] query failed:', {
			message: err.message,
			code: err.code,
			query: typeof args[0] === 'string' ? args[0].slice(0, 240).replace(/\s+/g, ' ') : '<non-string>'
		});
	});
	return result;
}) as UnsafeFn;

export const db = drizzle(client, { schema });
