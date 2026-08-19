import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: 'recipe-actions.e2e.ts',
	globalSetup: './tests/e2e/global-setup.ts',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		actionTimeout: 60_000,
		navigationTimeout: 60_000,
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], channel: 'chromium' },
		},
	],
	webServer: {
		command: process.env.PLAYWRIGHT_USE_DEV
			? `pnpm dev --port ${PORT}`
			: `pnpm build && pnpm preview --port ${PORT}`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
		stdout: 'ignore',
		stderr: 'pipe',
	},
});
