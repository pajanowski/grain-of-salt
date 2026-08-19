import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for end-to-end tests.
 *
 * Runs against a production build served by `vite preview` so tests exercise
 * the same bundle we ship. The webServer is only started when the URL is not
 * already reachable, which lets CI start the server itself (e.g. via a
 * service container) when desired.
 *
 * Local dev: `pnpm test:e2e` will build + preview automatically.
 * CI: the workflow starts a postgres service, pushes the schema, starts the
 * preview server, and runs the tests headlessly.
 */
const PORT = 4173;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
	testDir: '.',
	testMatch: '**/*.e2e.{ts,js}',
	globalSetup: './tests/e2e/global-setup.ts',
	// Tests live next to the routes they exercise; ignore everything else.
	testIgnore: ['**/node_modules/**', '**/build/**', '**/.svelte-kit/**'],

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

	webServer: {
		// CI builds the app itself and starts preview separately; locally we
		// build on demand so a fresh checkout can run tests without a manual
		// build step.
		//
		// To run the tests against the dev server (useful for catching
		// dev-only hydration/state issues), set `PLAYWRIGHT_USE_DEV=1`.
		// The preview server is what we ship, so by default we test the
		// production bundle.
		command: process.env.PLAYWRIGHT_USE_DEV
			? `pnpm dev --port ${PORT}`
			: process.env.CI
				? `pnpm preview --port ${PORT}`
				: `pnpm build && pnpm preview --port ${PORT}`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
		stdout: 'ignore',
		stderr: 'pipe'
	}
});
