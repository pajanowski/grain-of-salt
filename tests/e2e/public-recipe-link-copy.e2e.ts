/**
 * E2E tests for the public recipe toggle and share link in the recipe
 * actions menu. These run with the standard auth project (storageState set).
 */
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
	getRecipeHeading,
	getRecipeActionsButton,
	getRecipeActionsMenuItem,
	getShareCopyButton,
	getCopiedButton,
	getPublicRecipeShareLink,
	openCreateForm,
	getRecipeNameInput,
	getCreateButton,
	getRecipeLink,
} from './helpers/page-utils';

test.describe('public recipe — toggle and share link', () => {
	test('toggle public shows share link and flips menu label', async ({ page }) => {
		// Create a recipe under the test user via the UI.
		const recipeName = uuidv4();
		await page.goto('/mise');
		await openCreateForm(page);
		await getRecipeNameInput(page).fill(recipeName);
		await getCreateButton(page).click();
		await expect(getRecipeLink(page, recipeName)).toBeVisible();
		await getRecipeLink(page, recipeName).click();
		await expect(getRecipeHeading(page, recipeName)).toBeVisible();

		// Resolve the nodeId from the URL.
		const nodeId = page.url().split('/recipes/')[1];

		// Should NOT yet show the share link (not public).
		await expect(getPublicRecipeShareLink(page, nodeId)).not.toBeVisible();

		// Open the recipe actions menu.
		await getRecipeActionsButton(page).click();

		// Menu should show "Make public" (not yet public).
		await expect(getRecipeActionsMenuItem(page, 'Make public')).toBeVisible();

		// Click "Make public".
		await getRecipeActionsMenuItem(page, 'Make public').click();

		// Wait for the UI to update (invalidateAll resolves).
		await getRecipeActionsButton(page).click();
		await expect(getRecipeActionsMenuItem(page, 'Make private')).toBeVisible();

		// Share link should now be visible in the header.
		await expect(getPublicRecipeShareLink(page, nodeId)).toBeVisible();

		// Toggle back to private — click menu trigger twice to close then
		// reopen, so the menu item is visible when we click it.
		await getRecipeActionsButton(page).click();
		await getRecipeActionsButton(page).click();
		await getRecipeActionsMenuItem(page, 'Make private').click();

		// Menu label should flip back.
		await getRecipeActionsButton(page).click();
		await expect(getRecipeActionsMenuItem(page, 'Make public')).toBeVisible();

		// Share link should be gone.
		await expect(getPublicRecipeShareLink(page, nodeId)).not.toBeVisible();
	});

	test('copy button transitions to "Copied!" state', async ({ page }) => {
		// Create a recipe and make it public via the UI.
		const recipeName = uuidv4();
		await page.goto('/mise');
		await openCreateForm(page);
		await getRecipeNameInput(page).fill(recipeName);
		await getCreateButton(page).click();
		await expect(getRecipeLink(page, recipeName)).toBeVisible();
		await getRecipeLink(page, recipeName).click();
		await expect(getRecipeHeading(page, recipeName)).toBeVisible();

		// Make it public.
		await getRecipeActionsButton(page).click();
		await getRecipeActionsMenuItem(page, 'Make public').click();

		// Copy button should be visible and say "Copy".
		await expect(getShareCopyButton(page)).toBeVisible();

		await getShareCopyButton(page).click();

		// Button should show "Copied!" for 2 seconds then revert.
		await expect(getCopiedButton(page)).toBeVisible();
	});
});
