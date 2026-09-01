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
const client = postgres(env.DATABASE_URL, {
	// Small pool — Vercel functions may run concurrently across
	// instances and each instance keeps its own pool. Cap to stay
	// under Supabase's direct-connection limit (60 free tier, 200+ paid).
	max: 5,
	connection: {
		application_name: 'grain-of-salt-vercel'
	},
	onnotice: () => {
		// Suppress routine Postgres NOTICE/NOTIFY messages from server
		// logs. Remove this hook when debugging schema or trigger
		// activity.
	}
});

// Log the underlying postgres error on every failed query so the real
// cause (vs. Drizzle's "Failed query" wrapper) shows up in Vercel
// logs. postgres.js's `client.unsafe` returns a `PendingQuery<T>` that
// extends Promise AND carries extra methods (`.execute()`, `.values()`,
// `.raw()`, …) which Drizzle chains off of. Registering `.catch()` here
// would return a plain Promise and break that chain, so we attach the
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
