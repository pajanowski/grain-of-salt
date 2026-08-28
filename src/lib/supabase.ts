import { createBrowserClient, isBrowser } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

const SUPABASE_URL: string = env.PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY: string = env.PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	throw new Error(
		'PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY must be set in the environment'
	);
}

/**
 * Browser-side Supabase singleton.
 *
 * We use the @supabase/ssr browser client (not @supabase/supabase-js
 * `createClient`) so cookies stay consistent with the server-side flow.
 *
 * Note: most auth work happens via SvelteKit form actions, which run
 * server-side. This client is mainly useful for client-only interactions
 * (e.g. realtime channels, storage) — not for triggering auth.
 */
let client: SupabaseClient | undefined;

export function getBrowserSupabase(): SupabaseClient {
	if (!isBrowser()) {
		throw new Error('getBrowserSupabase() called outside the browser');
	}
	if (!client) {
		client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
	}
	return client;
}
