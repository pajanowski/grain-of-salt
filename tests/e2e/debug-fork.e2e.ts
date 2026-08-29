import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.beforeEach(async ({ page }) => {
	await signInAsTestUser(page);
});

test('debug fork flow', async ({ page }) => {
	// Capture network requests
	page.on('request', (req) => {
		console.log('>>', req.method(), req.url());
	});
	page.on('response', (res) => {
		console.log('<<', res.status(), res.url());
	});

	// Navigate to the home page
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Recipe List' })).toBeVisible();

	// Click French Omelette link
	const frenchLink = page.getByRole('link', { name: /French Omelette/ }).first();
	await expect(frenchLink).toBeVisible();
	await frenchLink.click();

	// Wait for the recipe page
	await page.waitForURL(/\/recipes\//);
	await expect(page.getByRole('heading', { name: 'Recipe: French Omelette' })).toBeVisible();

	// Get the URL to see what id is being used
	const url = page.url();
	console.log('Recipe URL:', url);

	// Open menu
	const menuBtn = page.getByRole('button', { name: 'Recipe actions' });
	await menuBtn.click();

	// Click fork
	const forkBtn = page.getByRole('menuitem', { name: 'Fork recipe' });
	await expect(forkBtn).toBeVisible();
	await forkBtn.click();

	// Modal opens
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Check pre-filled value
	const input = page.locator('[data-testid="fork-name-input"]');
	const prefill = await input.inputValue();
	console.log('Pre-filled name:', prefill);

	// Fill in new name
	await input.clear();
	await input.fill('My French Fork Test');

	// Save
	await page.getByTestId('fork-save').click();

	// Wait for navigation
	await page.waitForURL(/\/recipes\/[a-f0-9-]+$/, { timeout: 5000 });
	console.log('After fork URL:', page.url());
});
