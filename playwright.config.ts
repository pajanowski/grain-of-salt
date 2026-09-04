import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for end-to-end tests.
 *
 * Tests run inside the Playwright Docker image (see
 * scripts/run-e2e-docker.sh). The host is expected to already be running
 * `vite preview` on PORT (or `vite dev` when PLAYWRIGHT_USE_DEV=1) — we
 * therefore use `reuseExistingServer=true` and never spawn a server here.
 *
 * The container reaches the host's preview server via host.docker.internal.
 */
const PORT = 4173;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
	testDir: '.',
	testMatch: '**/*.e2e.{ts,js}',
	globalSetup: './tests/e2e/global-setup.ts',
	// Tests live next to the routes they exercise; ignore everything else.
	outputDir: './pw-test-results',
 	testIgnore: ['**/node_modules/**', '**/build/**', '**/.svelte-kit/**', 'tests/archive/**'],

	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI
		? [
				['github'],
				['html', { open: 'never', outputFolder: 'playwright-report' }],
				['list']
			]
		: 'list',

	use: {
		baseURL: BASE_URL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		// Dev server is much slower than preview due to on-demand compilation
		// and HMR overhead. Double the per-action and per-navigation budgets
		// when running against it.
		actionTimeout: process.env.PLAYWRIGHT_USE_DEV ? 60_000 : 10_000,
		navigationTimeout: process.env.PLAYWRIGHT_USE_DEV ? 60_000 : 10_000
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], channel: 'chromium' }
		}
	],

});
