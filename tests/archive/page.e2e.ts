import { expect, test } from '@playwright/test';

test.describe('home page', () => {
	test('renders the app shell with the Create Recipe button', async ({ page }) => {
		await page.goto('/');

		// The shell renders regardless of whether the DB has recipes.
		await expect(page.getByRole('button', { name: 'Create Recipe' })).toBeVisible();
	});

	test('opens the create-recipe form when the button is clicked', async ({ page }) => {
		await page.goto('/');

		await page.getByRole('button', { name: 'Create Recipe' }).click();

		// The form input becomes available once the form is open.
		await expect(page.locator('input').first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
	});

	test('can navigate to the playwright demo page from the demo index', async ({ page }) => {
		await page.goto('/demo');
		await page.getByRole('link', { name: 'playwright' }).click();

		await expect(page).toHaveURL(/\/demo\/playwright$/);
		await expect(page.getByRole('heading', { name: 'Playwright e2e test demo' })).toBeVisible();
	});
});
