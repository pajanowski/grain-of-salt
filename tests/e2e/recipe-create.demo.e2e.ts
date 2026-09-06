/**
 * Demo-mode e2e tests for the create-recipe UI (ADR 0003 — Demo suite).
 *
 * Mirror of tests/e2e/recipe-create.e2e.ts, but targeting the
 * VITE_DEMO_MODE=1 preview server with no Supabase running. Recipes
 * created here live in localStorage, not Postgres, so they survive
 * across reloads in the same browser context and are wiped by the
 * "Reset demo" button.
 *
 * Each test calls the reset button before exercising the flow so the
 * state is hermetic (the Playwright `demo` project starts with no
 * storageState). Recipe names are fresh uuids so they cannot collide
 * with the SEED_RECIPES baked into the demo adapter.
 */
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
	openCreateForm,
	getRecipeNameInput,
	getCreateButton,
	getCancelButton,
	getRecipeLink,
	getRecipeHeading
} from './helpers/page-utils';

/**
 * Reset the demo state via the layout's "Reset demo" button. The
 * button is rendered only when `data.demoMode === true`, which the
 * layout.server.ts sets for the demo hostname. Without this reset,
 * SEED_RECIPES would already be present on first load — fine for
 * most tests, but recipes with colliding uuids would race.
 */
async function resetDemoState(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	const resetButton = page.getByTestId('reset-demo');
	if (await resetButton.isVisible().catch(() => false)) {
		await resetButton.click();
	}
}

test('demo: create recipe — uuid name appears in the list and survives a reload', async ({
	page
}) => {
	await resetDemoState(page);
	await page.goto('/');

	const recipeName = uuidv4();

	await openCreateForm(page);
	await getRecipeNameInput(page).fill(recipeName);
	await getCreateButton(page).click();

	// Demo writable mutates synchronously — no invalidateAll round-trip
	// needed, but we still wait for the link to appear before asserting.
	await expect(getRecipeLink(page, recipeName)).toBeVisible();

	// Hard reload — localStorage persists, so the recipe still shows.
	await page.reload();
	await expect(getRecipeLink(page, recipeName)).toBeVisible();
});

test('demo: cancel closes the form without creating a recipe', async ({ page }) => {
	await resetDemoState(page);
	await page.goto('/');

	const recipeName = uuidv4();
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(recipeName);
	await getCancelButton(page).click();

	await expect(getRecipeNameInput(page)).toHaveCount(0);
	await expect(getRecipeLink(page, recipeName)).toHaveCount(0);
});

test('demo: cancel clears the form so a reopen starts blank', async ({ page }) => {
	await resetDemoState(page);
	await page.goto('/');

	await openCreateForm(page);
	await getRecipeNameInput(page).fill('first attempt');
	await getCancelButton(page).click();

	await openCreateForm(page);
	await expect(getRecipeNameInput(page)).toHaveValue('');
});

test('demo: creating two recipes in sequence makes both visible', async ({ page }) => {
	await resetDemoState(page);
	await page.goto('/');

	const nameA = uuidv4();
	const nameB = uuidv4();

	await openCreateForm(page);
	await getRecipeNameInput(page).fill(nameA);
	await getCreateButton(page).click();
	await expect(getRecipeLink(page, nameA)).toBeVisible();

	await openCreateForm(page);
	await getRecipeNameInput(page).fill(nameB);
	await getCreateButton(page).click();
	await expect(getRecipeLink(page, nameB)).toBeVisible();

	await expect(getRecipeLink(page, nameA)).toBeVisible();
	await expect(getRecipeLink(page, nameB)).toBeVisible();
});

test('demo: clicking a new recipe link navigates to its detail page', async ({ page }) => {
	await resetDemoState(page);
	await page.goto('/');

	const recipeName = uuidv4();
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(recipeName);
	await getCreateButton(page).click();

	const link = getRecipeLink(page, recipeName);
	await expect(link).toBeVisible();
	await link.click();
	await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]+/);
	await expect(getRecipeHeading(page, recipeName)).toBeVisible();
});

test('demo: reset button clears localStorage and restores the seed', async ({ page }) => {
	await resetDemoState(page);
	await page.goto('/');

	const pollution = uuidv4();
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(pollution);
	await getCreateButton(page).click();
	await expect(getRecipeLink(page, pollution)).toBeVisible();

	// Reset wipes the writable + localStorage back to SEED_RECIPES.
	await page.getByTestId('reset-demo').click();

	// After reset, the pollution recipe is gone and the seed is back.
	await expect(getRecipeLink(page, pollution)).toHaveCount(0);
	// SEED_RECIPES ships with "Pancakes" — confirm the seed is visible.
	await expect(getRecipeLink(page, 'Pancakes')).toBeVisible();
});
