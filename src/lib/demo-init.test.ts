/**
 * Tests for demo-init.ts — the demo-mode detection helpers.
 *
 * Detection has three surfaces (ADR 0003 — Detection):
 *   - `isDemoHost(hostname)` is the strict hostname-only check.
 *   - `isDemoServer(hostname, env)` is the SSR-side check: accepts
 *     either a `demo.*` hostname OR the deployer's env flag.
 *   - `isDemoMode(windowLike, env)` is the client-side check: both
 *     signals must agree (defense in depth).
 *
 * The two server checks diverge because the deployer controls both
 * signals, while the client env value is baked into the JS bundle
 * that ships to every visitor.
 */
import { describe, it, expect } from 'vitest';
import { isDemoHost, isDemoMode, isDemoServer } from './demo-init';

describe('isDemoHost', () => {
	it('returns true for demo.grainofsalt.app', () => {
		expect(isDemoHost('demo.grainofsalt.app')).toBe(true);
	});

	it('returns true for any subdomain starting with "demo."', () => {
		expect(isDemoHost('demo.example.com')).toBe(true);
		expect(isDemoHost('demo.localhost')).toBe(true);
	});

	it('returns false for the bare production hostname', () => {
		expect(isDemoHost('grainofsalt.app')).toBe(false);
	});

	it('returns false for localhost (production local-dev)', () => {
		expect(isDemoHost('localhost')).toBe(false);
		expect(isDemoHost('127.0.0.1')).toBe(false);
	});

	it('returns false for an empty hostname', () => {
		expect(isDemoHost('')).toBe(false);
	});

	it('does not match "demo" without the dot prefix (no false positives)', () => {
		expect(isDemoHost('demograine.com')).toBe(false);
		expect(isDemoHost('notdemo.example.com')).toBe(false);
	});
});

describe('isDemoMode', () => {
	it('returns true when window.location.hostname starts with "demo." and the env flag is on', () => {
		const fakeWindow = { location: { hostname: 'demo.localhost' } } as Window & typeof globalThis;
		expect(isDemoMode(fakeWindow, '1')).toBe(true);
	});

	it('returns false when the hostname is demo.* but the env flag is unset', () => {
		const fakeWindow = { location: { hostname: 'demo.example.com' } } as Window & typeof globalThis;
		expect(isDemoMode(fakeWindow, undefined)).toBe(false);
		expect(isDemoMode(fakeWindow, '')).toBe(false);
	});

	it('returns false on a non-demo hostname even when the env flag is set', () => {
		const fakeWindow = { location: { hostname: 'localhost' } } as Window & typeof globalThis;
		expect(isDemoMode(fakeWindow, '1')).toBe(false);
	});

	it('returns false on the production hostname even when the env flag is set', () => {
		const fakeWindow = { location: { hostname: 'grainofsalt.app' } } as Window & typeof globalThis;
		expect(isDemoMode(fakeWindow, '1')).toBe(false);
	});

	it('returns false on any non-"1" value of the env flag', () => {
		const fakeWindow = { location: { hostname: 'demo.local' } } as Window & typeof globalThis;
		expect(isDemoMode(fakeWindow, 'true')).toBe(false);
		expect(isDemoMode(fakeWindow, '0')).toBe(false);
		expect(isDemoMode(fakeWindow, 'yes')).toBe(false);
	});
});

describe('isDemoServer', () => {
	it('returns true on a demo.* hostname regardless of env flag', () => {
		expect(isDemoServer('demo.grainofsalt.app', undefined)).toBe(true);
		expect(isDemoServer('demo.localhost', '')).toBe(true);
		expect(isDemoServer('demo.localhost', '1')).toBe(true);
	});

	it('returns true on any hostname when the env flag is "1"', () => {
		// Local preview: `VITE_DEMO_MODE=1 pnpm preview` runs on
		// 127.0.0.1 — accept the env flag alone so local testing works
		// without /etc/hosts gymnastics. Production never sets the flag.
		expect(isDemoServer('127.0.0.1', '1')).toBe(true);
		expect(isDemoServer('localhost', '1')).toBe(true);
	});

	it('returns false on any hostname when the env flag is unset', () => {
		expect(isDemoServer('127.0.0.1', undefined)).toBe(false);
		expect(isDemoServer('localhost', '')).toBe(false);
		expect(isDemoServer('localhost', 'true')).toBe(false);
		expect(isDemoServer('grainofsalt.app', undefined)).toBe(false);
	});
});
