import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import { DEV_SESSION, DEV_USER } from './server/singleUser';

/**
 * Creates a no-op stub Supabase client for SSR during demo mode.
 * Satisfies auth, table queries, storage, and RPC invocations without
 * making network or database calls.
 */
export function makeStubSupabase(): SupabaseClient {
	const chainBuilder: any = {
		select: () => chainBuilder,
		insert: () => chainBuilder,
		update: () => chainBuilder,
		delete: () => chainBuilder,
		eq: () => chainBuilder,
		neq: () => chainBuilder,
		in: () => chainBuilder,
		order: () => chainBuilder,
		limit: () => chainBuilder,
		single: async () => ({ data: null, error: null }),
		maybeSingle: async () => ({ data: null, error: null }),
		then: (resolve: (val: any) => void) => resolve({ data: [], error: null })
	};

	const stub: any = {
		auth: {
			getSession: async (): Promise<{ data: { session: Session | null }; error: null }> => ({
				data: { session: DEV_SESSION },
				error: null
			}),
			getUser: async (): Promise<{ data: { user: User | null }; error: null }> => ({
				data: { user: DEV_USER },
				error: null
			}),
			signInWithOtp: async () => ({ data: {}, error: null }),
			verifyOtp: async () => ({ data: { session: DEV_SESSION, user: DEV_USER }, error: null }),
			signOut: async () => ({ error: null })
		},
		from: () => chainBuilder,
		rpc: async () => ({ data: [], error: null }),
		storage: {
			from: () => ({
				upload: async () => ({ data: { path: '' }, error: null }),
				remove: async () => ({ data: [], error: null }),
				getPublicUrl: (path: string) => ({ data: { publicUrl: `/demo-images/${path}` } })
			})
		}
	};

	return stub as unknown as SupabaseClient;
}
