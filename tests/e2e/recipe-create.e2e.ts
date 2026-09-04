/**
 * E2E test for the create-recipe UI on the home page. The recipe name is a
 * fresh uuid so the test is hermetic against the seeded demo tree under
 * TEST_USER_ID — the new root recipe sorts into the tree alongside the
 * cloned demo recipes and we look it up by exact uuid text.
 *
 * The DB is seeded exactly once per suite by tests/e2e/global-setup.ts;
 * no per-test reset is performed. The uuid-named recipe persists across
 * runs (no global teardown cleans it up by design — leave that to the
 * next milestone if it becomes a problem).
 */
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { signInAsTestUser } from './helpers/auth';

test('create recipe: uuid name appears in the recipe list and persists across reload', async ({
	page
}) => {
	await signInAsTestUser(page);
	await page.goto('/');

	const recipeName = uuidv4();

	// Open the inline create-recipe form.
	await page.getByRole('button', { name: 'Create Recipe' }).click();

	// The form input is the first <input> on the page after the form opens.
	const nameInput = page.locator('form input').first();
	await expect(nameInput).toBeVisible();
	await nameInput.fill(recipeName);

	// Submit. The handler awaits /api/save, then calls invalidateAll() which
	// re-runs the layout load and re-renders RecipeList with the new entry.
	await page.getByRole('button', { name: 'Create', exact: true }).click();

	// The real post-condition: the new root recipe is rendered as a link in
	// RecipeList. Wait for it instead of racing on form-close.
	const newRecipeLink = page.getByRole('link', { name: recipeName, exact: true });
	await expect(newRecipeLink).toBeVisible();

	// Hard reload to bypass any client cache and read straight from the server.
	// This proves the row was actually persisted to the database, not just
	// optimistically rendered.
	await page.reload();
	await expect(page.getByRole('link', { name: recipeName, exact: true })).toBeVisible();
});
