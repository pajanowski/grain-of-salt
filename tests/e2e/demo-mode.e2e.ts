import { test, expect } from '@playwright/test';
import {
	openCreateForm,
	getRecipeNameInput,
	getCreateButton,
	getRecipeLink
} from './helpers/page-utils';

test.describe('Demo Mode (demo.localhost / demo subdomain)', () => {
	// Use an isolated context without cookies/storage state
	test.use({ storageState: undefined });

	test('allows jumping to demo mode from the home screen', async ({ page }) => {
		await page.goto('/');

		// Should show Sign in / Open the App and Try Demo button
		const demoButton = page.getByTestId('home-demo-button');
		await expect(demoButton).toBeVisible();
		await expect(demoButton).toHaveText('Try Demo');

		// Clicking the button should navigate into the demo environment
		await demoButton.click();

		await expect(page).toHaveURL(/.*\/mise/);
		const banner = page.getByTestId('demo-mode-banner');
		await expect(banner).toBeVisible();
		await expect(getRecipeLink(page, 'Simple Omelette')).toBeVisible();
	});

	test('loads seeded recipes without login on demo subdomain', async ({ page }) => {
		await page.goto('http://demo.localhost:4173/mise');

		// Demo banner should be visible
		const banner = page.getByTestId('demo-mode-banner');
		await expect(banner).toBeVisible();
		await expect(banner).toContainText('Demo');

		// Seeded recipes should be visible in recipe list
		const simpleOmelette = getRecipeLink(page, 'Simple Omelette');
		await expect(simpleOmelette).toBeVisible();

		const frenchOmelette = getRecipeLink(page, 'French Omelette');
		await expect(frenchOmelette).toBeVisible();
	});

	test('persists custom recipe creation and edits across reloads, and resets on demand', async ({ page }) => {
		await page.goto('http://demo.localhost:4173/mise');

		const customName = `Demo Waffles ${Date.now()}`;

		// Create a new recipe in demo mode
		await openCreateForm(page);
		await getRecipeNameInput(page).fill(customName);
		await getCreateButton(page).click();

		const newLink = getRecipeLink(page, customName);
		await expect(newLink).toBeVisible();

		// Navigate into the recipe
		await newLink.click();
		await expect(page).toHaveURL(/\/mise\/recipes\/.+/);

		const heading = page.getByRole('heading', { name: customName, level: 1 });
		await expect(heading).toBeVisible();

		// Toggle favorite
		const star = page.getByTestId('recipe-favorite-star');
		await expect(star).toBeVisible();
		await star.click();
		await expect(star).toHaveAttribute('aria-label', 'Unfavorite recipe');

		// Reload the browser page to ensure localStorage persistence
		await page.reload();
		await expect(heading).toBeVisible();
		await expect(star).toHaveAttribute('aria-label', 'Unfavorite recipe');

		// Return to /mise dashboard
		await page.goto('http://demo.localhost:4173/mise');
		await expect(getRecipeLink(page, customName)).toBeVisible();

		// Click Reset Demo
		const resetButton = page.getByTestId('reset-demo-button');
		await expect(resetButton).toBeVisible();
		await resetButton.click();

		// The custom recipe should no longer exist
		await expect(getRecipeLink(page, customName)).not.toBeVisible();

		// Canonical seed recipes should still be present
		await expect(getRecipeLink(page, 'Simple Omelette')).toBeVisible();
	});
});
