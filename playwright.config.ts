import { defineConfig, devices } from '@playwright/test';

/**
 * Tests run inside the Playwright Docker image (see
 * scripts/run-e2e-docker.sh). The host is expected to already be running
 * `vite preview` on PORT (or `vite dev` when PLAYWRIGHT_USE_DEV=1) — we
 * therefore use `reuseExistingServer=true` and never spawn a server here.
 *
 * The container shares the host's network namespace (`--network host`),
 * so `localhost` inside the container reaches the host's preview server.
 */
const PORT = 4173;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/build/**',
  '**/.svelte-kit/**',
  '**/.auth/**',
  'tests/archive/**'
];

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.{ts,js}',
  globalSetup: './tests/e2e/global-setup.ts',
  outputDir: 'pw-test-results',
  testIgnore: IGNORE_PATTERNS,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [
      ['github'],
      ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ]
    : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: process.env.PLAYWRIGHT_USE_DEV ? 60_000 : 10_000,
    navigationTimeout: process.env.PLAYWRIGHT_USE_DEV ? 60_000 : 10_000
  },

  projects: [
    {
      name: 'chromium',
      testMatch: '**/*.e2e.ts',
      testIgnore: [...IGNORE_PATTERNS, '**/auth.e2e.ts'],
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        storageState: '.auth/test-user.json'
      }
    },
    {
      name: 'chromium-noauth',
      testMatch: '**/auth.e2e.ts',
      testIgnore: IGNORE_PATTERNS,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        storageState: undefined
      }
    }
  ],
});
