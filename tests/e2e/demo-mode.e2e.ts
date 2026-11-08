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

		const bouillabaisse = getRecipeLink(page, "Auguste's Bouillabaisse");
		await expect(bouillabaisse).toBeVisible();

		const weeknightBouill = getRecipeLink(page, 'Weeknight Bouillabaisse');
		await expect(weeknightBouill).toBeVisible();

		const bouillForTwo = getRecipeLink(page, 'Provençal Bouillabaisse for Two');
		await expect(bouillForTwo).toBeVisible();
	});

	test('renders recipe graph canvas without sign in prompt in demo mode', async ({ page }) => {
		await page.goto('http://demo.localhost:4173/mise');

		// Click into Simple Omelette
		const simpleOmelette = getRecipeLink(page, 'Simple Omelette');
		await simpleOmelette.click();
		await expect(page).toHaveURL(/\/mise\/recipes\/[0-9a-f-]+$/);

		// Click Graph tab
		const graphTab = page.getByTestId('tab-graph');
		await expect(graphTab).toBeVisible();
		await graphTab.click();

		await expect(page).toHaveURL(/\/mise\/recipes\/[0-9a-f-]+\/graph$/);

		// Must not prompt to sign in
		await expect(page.getByText('Sign in to view the recipe graph.')).not.toBeVisible();

		// SvelteFlow canvas and graph heading should be visible
		await expect(page.getByRole('heading', { name: 'Recipe Graph', level: 1 })).toBeVisible();
		const canvas = page.locator('.svelte-flow');
		await expect(canvas).toBeVisible({ timeout: 10_000 });

		// Should render the recipe DAG nodes (Simple Omelette, French, Cheese, Denver, Spicy Denver)
		const nodes = page.locator('.svelte-flow__node');
		await expect(nodes).toHaveCount(5, { timeout: 10_000 });
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

	test('auto-upgrades and shows all seeded recipes when localStorage has stale unversioned cache', async ({ page }) => {
		// Populate localStorage with stale 6-recipe data and no demo:version before navigating
		await page.goto('http://demo.localhost:4173/');
		await page.evaluate(() => {
			localStorage.removeItem('demo:version');
			localStorage.setItem('demo:recipes', JSON.stringify([
				{ id: '00000000-0000-0000-0000-000000000010', name: 'Simple Omelette', parentId: null },
				{ id: '00000000-0000-0000-0000-000000000020', name: 'French Omelette', parentId: '00000000-0000-0000-0000-000000000010' },
				{ id: '00000000-0000-0000-0000-000000000030', name: 'Cheese Omelette', parentId: '00000000-0000-0000-0000-000000000010' },
				{ id: '00000000-0000-0000-0000-000000000040', name: 'Denver Omelette', parentId: '00000000-0000-0000-0000-000000000030' },
				{ id: '00000000-0000-0000-0000-000000000050', name: 'Spicy Denver Omelette', parentId: '00000000-0000-0000-0000-000000000040' },
				{ id: '00000000-0000-0000-0000-000000000101', name: "Auguste's Bouillabaisse", parentId: null }
			]));
			localStorage.setItem('demo:nodes', JSON.stringify([]));
		});

		await page.goto('http://demo.localhost:4173/mise');

		// All seeded recipes including new Bouillabaisse variants should be visible
		await expect(getRecipeLink(page, 'Simple Omelette')).toBeVisible();
		await expect(getRecipeLink(page, "Auguste's Bouillabaisse")).toBeVisible();
		await expect(getRecipeLink(page, 'Weeknight Bouillabaisse')).toBeVisible();
		await expect(getRecipeLink(page, 'Bouillabaisse with Rouille')).toBeVisible();
		await expect(getRecipeLink(page, 'Provençal Bouillabaisse for Two')).toBeVisible();
	});
});
