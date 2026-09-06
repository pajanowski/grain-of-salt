/**
 * No-op Supabase client for demo mode (ADR 0003 — Stub Supabase client).
 *
 * The existing `+page.server.ts` load functions call
 * `locals.supabase.from(...)` etc. In demo mode we install this stub
 * on `event.locals.supabase` so those load functions succeed
 * unchanged — they just see empty data.
 *
 * Coverage rule: add a method here whenever a load function surfaces
 * a missing one. The stub's tests pin every method any loader calls;
 * if the loader grows, the stub (and its tests) grow with it.
 */

interface StubQueryResult<T> {
	data: T | null;
	error: null;
	count?: number | null;
	status: number;
	statusText: string;
}

/**
 * A thenable, chainable query builder. Every method resolves to
 * `{ data: [], error: null }` so load functions that read
 * `data ?? []` or check `error` behave correctly.
 */
class StubQueryBuilder<T = unknown> implements PromiseLike<StubQueryResult<T[]>> {
	private readonly result: StubQueryResult<T[]>;

	constructor() {
		this.result = { data: [], error: null, status: 200, statusText: 'OK' };
	}

	select(_columns?: string): this {
		return this;
	}
	insert(_values: unknown): this {
		this.result.data = null;
		return this;
	}
	update(_values: unknown): this {
		this.result.data = null;
		return this;
	}
	upsert(_values: unknown): this {
		this.result.data = null;
		return this;
	}
	delete(): this {
		this.result.data = null;
		return this;
	}
	eq(_column: string, _value: unknown): this {
		return this;
	}
	neq(_column: string, _value: unknown): this {
		return this;
	}
	gt(_column: string, _value: unknown): this {
		return this;
	}
	gte(_column: string, _value: unknown): this {
		return this;
	}
	lt(_column: string, _value: unknown): this {
		return this;
	}
	lte(_column: string, _value: unknown): this {
		return this;
	}
	like(_column: string, _pattern: string): this {
		return this;
	}
	ilike(_column: string, _pattern: string): this {
		return this;
	}
	in(_column: string, _values: unknown[]): this {
		return this;
	}
	is(_column: string, _value: unknown): this {
		return this;
	}
	order(_column: string, _opts?: { ascending?: boolean }): this {
		return this;
	}
	limit(_count: number): this {
		return this;
	}
	range(_from: number, _to: number): this {
		return this;
	}
	single(): Promise<StubQueryResult<T>> {
		return Promise.resolve({ data: null, error: null, status: 200, statusText: 'OK' });
	}
	maybeSingle(): Promise<StubQueryResult<T | null>> {
		return Promise.resolve({ data: null, error: null, status: 200, statusText: 'OK' });
	}

	then<R1 = StubQueryResult<T[]>, R2 = never>(
		onfulfilled?: (value: StubQueryResult<T[]>) => R1 | PromiseLike<R1>,
		onrejected?: (reason: unknown) => R2 | PromiseLike<R2>
	): PromiseLike<R1 | R2> {
		return Promise.resolve(this.result).then(onfulfilled, onrejected);
	}
}

interface AuthSession {
	data: { session: null; user: null };
	error: null;
}

interface AuthUser {
	data: { user: null };
	error: null;
}

interface AuthSignResult {
	data: Record<string, never>;
	error: null;
}

const stubAuth = {
	async getSession(): Promise<AuthSession> {
		return { data: { session: null, user: null }, error: null };
	},
	async getUser(): Promise<AuthUser> {
		return { data: { user: null }, error: null };
	},
	async signInWithOtp(_opts: unknown): Promise<AuthSignResult> {
		return { data: {}, error: null };
	},
	async verifyOtp(_opts: unknown): Promise<AuthSignResult> {
		return { data: {}, error: null };
	},
	async signOut(): Promise<AuthSignResult> {
		return { data: {}, error: null };
	}
};

export interface StubSupabase {
	from(table: string): StubQueryBuilder;
	auth: typeof stubAuth;
}

/**
 * Build a Supabase-shaped client whose every method resolves
 * successfully with no data. Used in demo mode to satisfy existing
 * load functions without a real backend.
 */
export function makeStubSupabase(): StubSupabase {
	return {
		from(_table: string): StubQueryBuilder {
			return new StubQueryBuilder();
		},
		auth: stubAuth
	};
}
