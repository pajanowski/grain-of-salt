/**
 * E2E tests for the /mise/recipes/[slug]/graph page.
 *
 * The test user (TEST_USER_ID) owns a seeded "Simple Omelette" recipe tree
 * cloned from the demo recipes in global-setup.ts. We look up that recipe's
 * id from the DB once per worker so the slug doesn't drift if the seed changes.
 *
 * These tests verify:
 *   1. The page loads without crashing (no SvelteFlowProvider error).
 *   2. The SvelteFlow canvas mounts and renders nodes.
 *   3. Clicking a node navigates to the correct recipe page.
 */

import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { recipeNodes } from '$lib/server/db/schema';
import { TEST_USER_ID } from './helpers/auth-shared';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * Resolve the test user's root recipe slug once per worker.
 * Stored in a module-level variable so the hard-coded slug doesn't drift.
 */
let TEST_RECIPE_SLUG: string;

test.beforeAll(async () => {
  const sql = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(sql);

  const rows = await db
    .select({ id: recipeNodes.id })
    .from(recipeNodes)
    .where(eq(recipeNodes.ownerId, TEST_USER_ID))
    .limit(1);
  sql.end();

  if (rows.length === 0) {
    throw new Error(
      `No recipe found for TEST_USER_ID=${TEST_USER_ID}. ` +
      'Run global-setup or use the profile seed-recipes button first.'
    );
  }
  TEST_RECIPE_SLUG = rows[0].id;
});

test.describe('recipe graph page', () => {
  test('page loads without SvelteFlowProvider error', async ({ page }) => {
    // Intercept console errors so we can assert none were emitted.
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto(`/mise/recipes/${TEST_RECIPE_SLUG}/graph`);

    // Wait for the heading — if SvelteFlowProvider is missing the error is
    // thrown synchronously during component initialisation.
    await expect(page.getByRole('heading', { name: 'Recipe Graph' })).toBeVisible();

    // Allow network-heavy dynamic import up to 10 s.
    await page.waitForFunction(
      () => document.querySelector('.svelte-flow') !== null,
      { timeout: 10_000 }
    ).catch(() => { });

    // Assert no console errors were emitted.
    const providerErrors = consoleErrors.filter(
      (e) => e.includes('SvelteFlowProvider') || e.includes('001')
    );
    expect(providerErrors, `Unexpected console errors: ${consoleErrors.join('\n')}`).toHaveLength(0);
  });

  test('SvelteFlow canvas is rendered', async ({ page }) => {
    await page.goto(`/mise/recipes/${TEST_RECIPE_SLUG}/graph`);
    await expect(page.getByRole('heading', { name: 'Recipe Graph' })).toBeVisible();

    // The canvas root element added by @xyflow/svelte.
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a node navigates to its recipe page', async ({ page }) => {
    await page.goto(`/mise/recipes/${TEST_RECIPE_SLUG}/graph`);
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 10_000 });

    // SvelteFlow nodes use the .svelte-flow__node class.
    // The first node is the root (current recipe) which links to the recipe list,
    // not a recipe detail page. Click a child node instead.
    const nodes = page.locator('.svelte-flow__node');
    await expect(nodes).toHaveCount(1, { timeout: 10_000 }); // root + 3 descendants
    const childNode = nodes.nth(0);
    await expect(childNode).toBeVisible();

    await childNode.click();

    // The URL should now point at a recipe detail page.
    await expect(page).toHaveURL(/\/mise\/recipes\/[a-f0-9-]+$/);
  });

  test('"Back to recipe" link returns to the source recipe page', async ({ page }) => {
    await page.goto(`/mise/recipes/${TEST_RECIPE_SLUG}/graph`);
    await expect(page.getByRole('heading', { name: 'Recipe Graph' })).toBeVisible();

    await page.getByRole('link', { name: '← Back to recipe' }).click();

    await expect(page).toHaveURL(new RegExp(`^http://localhost:4173/mise/recipes/${TEST_RECIPE_SLUG}$`));
  });
});
