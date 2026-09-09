/**
 * E2E tests for the public recipe toggle and share link in the recipe
 * actions menu. These run with the standard auth project (storageState set).
 */
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import postgres from 'postgres';

const db = postgres('postgres://postgres:postgres@127.0.0.1:54322/postgres');

async function createRecipeNode(name: string, ownerId: string): Promise<{ nodeId: string }> {
  const row = await db`
		insert into recipe_nodes (id, name, owner_id, ingredient_changes, direction_changes)
		values (gen_random_uuid(), ${name}, ${ownerId}::uuid, '[]'::jsonb, '[]'::jsonb)
		returning id
	`;
  return { nodeId: row[0].id };
}

test.describe('public recipe — toggle and share link', () => {
  test('toggle public shows share link and flips menu label', async ({ page }) => {
    // Create a recipe under the test user.
    const recipeName = uuidv4();
    const { nodeId } = await createRecipeNode(recipeName, '11111111-1111-1111-1111-111111111111');

    // Navigate to the recipe page.
    await page.goto(`/mise/recipes/${nodeId}`);

    // Should NOT yet show the share link (not public).
    await expect(page.getByRole('link', { name: `/recipe/${nodeId}` })).not.toBeVisible();

    // Open the recipe actions menu.
    await page.getByRole('button', { name: 'Recipe actions' }).click();

    // Menu should show "Make public" (not yet public).
    await expect(page.getByRole('menuitem', { name: 'Make public' })).toBeVisible();

    // Click "Make public".
    await page.getByRole('menuitem', { name: 'Make public' }).click();

    // Wait for the UI to update (invalidateAll resolves).
    await page.getByRole('button', { name: 'Recipe actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Make private' })).toBeVisible();

    // Share link should now be visible in the header.
    await expect(page.locator(`a[href="/recipe/${nodeId}"]`)).toBeVisible();

    // Toggle back to private.
    await page.getByRole('button', { name: 'Recipe actions' }).click();
    await page.getByRole('button', { name: 'Recipe actions' }).click();
    await page.getByRole('menuitem', { name: 'Make private' }).click();

    // Menu label should flip back.
    await page.getByRole('button', { name: 'Recipe actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Make public' })).toBeVisible();

    // Share link should be gone.
    await expect(page.getByRole('link', { name: `/recipe/${nodeId}` })).not.toBeVisible();
  });

  test('copy button transitions to "Copied!" state', async ({ page }) => {
    const recipeName = uuidv4();
    const { nodeId } = await createRecipeNode(recipeName, '11111111-1111-1111-1111-111111111111');

    // Set it public directly in DB.
    await db`update recipe_nodes set is_public = true where id = ${nodeId}::uuid`;

    await page.goto(`/mise/recipes/${nodeId}`);

    // Copy button should be visible and say "Copy".
    const copyBtn = page.getByRole('button', { name: 'Copy' });
    await expect(copyBtn).toBeVisible();

    await copyBtn.click();

    // Button should show "Copied!" for 2 seconds then revert.
    await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
  });
});
