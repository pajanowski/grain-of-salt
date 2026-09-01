import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

// Cloudflare Hyperdrive brokers the Postgres connection at the runtime
// level with per-request I/O context isolation — postgres.js's pool
// alone cannot do this and trips the "Cannot perform I/O on behalf of
// a different request" guard when SvelteKit fires `+layout` and
// `+page` loads in parallel via `Promise.all`. In deployed mode we
// prefer the Hyperdrive binding over a raw DATABASE_URL for that
// reason. In local dev (`pnpm dev`) Hyperdrive isn't bound, so we
// fall back to DATABASE_URL pointing at the local Supabase stack.
// Cast HYPERDRIVE until `wrangler types` regenerates with the binding
// (placeholder id makes the generated env type still treat it as a
// string). Once the real id is in place, the cast is a no-op.
const hyperdrive = env.HYPERDRIVE as unknown as { connectionString?: string } | undefined;
const connectionString: string | undefined = hyperdrive?.connectionString ?? env.DATABASE_URL;
if (!connectionString) {
	throw new Error('Neither HYPERDRIVE binding nor DATABASE_URL is set');
}

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
const client = postgres(connectionString, {
	// Hyperdrive handles connection pooling and per-request I/O context
	// isolation, so prepared statements (the default) are safe again —
	// they no longer cross request boundaries.
	// Local-dev `pnpm dev` keeps prepared statements on too; the
	// connection goes to the local stack where there's no Workers I/O
	// guard.
	// Small per-isolate pool to amortize handshake cost for back-to-back
	// queries in the same request.
	max: 5,
	connection: {
		application_name: 'grain-of-salt-worker'
	},
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
