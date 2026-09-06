/**
 * Tests for the no-op Supabase stub (src/lib/supabase-stub.ts).
 *
 * The stub satisfies every method the existing +page.server.ts load
 * functions call so demo mode boots without a real Supabase project.
 * Coverage rule: add a test for every method any loader actually calls.
 * If a new loader surfaces a missing method, the test suite grows in
 * lockstep.
 */
import { describe, it, expect } from 'vitest';
import { makeStubSupabase } from './supabase-stub';

describe('makeStubSupabase', () => {
	it('exposes a from() chain that resolves to { data: [], error: null }', async () => {
		const stub = makeStubSupabase();
		const result = await stub.from('any_table').select('*');
		expect(result.data).toEqual([]);
		expect(result.error).toBeNull();
	});

	it('chainable query builder: .from(t).select(c).eq(k, v).order() etc all resolve to empty results', async () => {
		const stub = makeStubSupabase();
		const result = await stub
			.from('recipe_nodes')
			.select('*')
			.eq('owner_id', 'whatever')
			.order('timestamp')
			.limit(10);
		expect(result.data).toEqual([]);
		expect(result.error).toBeNull();
	});

	it('insert / update / delete return { data: null, error: null } (no-op writes)', async () => {
		const stub = makeStubSupabase();
		const insert = await stub.from('recipe_nodes').insert({ id: 'x' });
		expect(insert.data).toBeNull();
		expect(insert.error).toBeNull();

		const update = await stub.from('recipe_nodes').update({ name: 'x' }).eq('id', 'y');
		expect(update.data).toBeNull();
		expect(update.error).toBeNull();

		const del = await stub.from('recipe_nodes').delete().eq('id', 'y');
		expect(del.data).toBeNull();
		expect(del.error).toBeNull();
	});

	it('auth.getSession() returns { data: { session: null }, error: null }', async () => {
		const stub = makeStubSupabase();
		const result = await stub.auth.getSession();
		expect(result.data.session).toBeNull();
		expect(result.error).toBeNull();
	});

	it('auth.getUser() returns { data: { user: null }, error: null }', async () => {
		const stub = makeStubSupabase();
		const result = await stub.auth.getUser();
		expect(result.data.user).toBeNull();
		expect(result.error).toBeNull();
	});

	it('auth.signInWithOtp() resolves successfully with no error', async () => {
		const stub = makeStubSupabase();
		const result = await stub.auth.signInWithOtp({ email: 'demo@example.com' });
		expect(result.error).toBeNull();
	});

	it('auth.verifyOtp() resolves successfully with no error', async () => {
		const stub = makeStubSupabase();
		const result = await stub.auth.verifyOtp({
			email: 'demo@example.com',
			token: '00000000',
			type: 'email'
		});
		expect(result.error).toBeNull();
	});

	it('auth.signOut() resolves successfully', async () => {
		const stub = makeStubSupabase();
		const result = await stub.auth.signOut();
		expect(result.error).toBeNull();
	});
});
