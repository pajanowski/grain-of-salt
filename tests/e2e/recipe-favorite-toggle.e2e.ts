/**
 * E2E test for the favorite flag on recipe nodes.
 *
 * Drives the toggle entirely through the recipe actions menu and asserts
 * on the visible UI affordance (the menu item label flips to indicate the
 * new state). This keeps the test on the same path the user takes and
 * avoids opening a second postgres connection from a browser test.
 *
 * Per TDD: this test exists BEFORE the API, schema, and menu wiring — it
 * must fail to compile/run until those land.
 */
import { expect, test } from '@playwright/test';
import {
	openCreateForm,
	getRecipeNameInput,
	getCreateButton,
	getRecipeLink
} from './helpers/page-utils';

test('owner can favorite and unfavorite a recipe node from the actions menu', async ({ page }) => {
	const recipeName = crypto.randomUUID();

	// Create the recipe through the UI (AGENTS.md: avoid direct DB writes).
	await page.goto('/mise');
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(recipeName);
	await getCreateButton(page).click();
	const link = getRecipeLink(page, recipeName);
	await expect(link).toBeVisible();
	await link.click();
	await expect(page).toHaveURL(/\/mise\/recipes\/[0-9a-f-]+/);

	// Favorite via the actions menu.
	const favoriteResponse = page.waitForResponse(
		(r) => r.url().includes('/mise/api/recipe-node/') && r.url().endsWith('/favorite') && r.request().method() === 'PATCH'
	);
	await page.getByRole('button', { name: 'Recipe actions' }).click();
	await page.getByRole('menuitem', { name: 'Favorite' }).click();
	await favoriteResponse;

	// Reopen the menu — the item should now read "Unfavorite", which is the
	// user-visible proof the flag flipped.
	await page.getByRole('button', { name: 'Recipe actions' }).click();
	await expect(page.getByRole('menuitem', { name: 'Unfavorite' })).toBeVisible();

	// Toggle back.
	const unfavoriteResponse = page.waitForResponse(
		(r) => r.url().includes('/mise/api/recipe-node/') && r.url().endsWith('/favorite') && r.request().method() === 'PATCH'
	);
	await page.getByRole('menuitem', { name: 'Unfavorite' }).click();
	await unfavoriteResponse;

	await page.getByRole('button', { name: 'Recipe actions' }).click();
	await expect(page.getByRole('menuitem', { name: 'Favorite' })).toBeVisible();
});
