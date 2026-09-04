/**
 * Verbatim Playwright codegen reproduction. The steps came from running
 * `playwright codegen` against the dev server after `make run` + `make
 * db-fresh`. Each click that toggles form visibility is followed by a
 * `waitFor({ state: 'visible' })` on the next interactive element so the
 * test waits for the real post-condition instead of racing Svelte's
 * reactivity.
 *
 * Per ADR 0001 the save endpoint mutates the leaf's JSONB columns in
 * place — the saved Peanut butter IS expected to appear on Simple after
 * reload. The cross-recipe guard we keep here is the Celery-not-on-Simple
 * assertion: an edit on Denver must not leak onto the Simple slug page.
 */
import { expect, test } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';
import { resetTestUserRecipes } from './helpers/setup';

test.beforeEach(async ({ page }) => {
	await resetTestUserRecipes();
	await signInAsTestUser(page);
});

test('codegen scenario: add to simple, add to denver, verify cross-recipe leak guard', async ({
	page
}) => {
	// Step 1: open Simple Omelette.
	await page.getByRole('link', { name: 'Simple Omelette' }).click();
	await page.waitForURL(/\/recipes\//);
	await expect(page.getByRole('heading', { name: 'Recipe: Simple Omelette' })).toBeVisible();
	const addBtn = page.getByRole('button', { name: 'Add new ingredient' });
	await addBtn.waitFor({ state: 'visible' });

	// Step 2: add Peanut butter.
	await addBtn.click();
	const simpleNameInput = page.getByPlaceholder('Name').first();
	await simpleNameInput.waitFor({ state: 'visible' });
	await simpleNameInput.fill('Peanut butter');
	await page.getByRole('button', { name: 'Add', exact: true }).click();

	// Save.
	const save = page.getByRole('button', { name: 'Save', exact: true });
	await expect(save).toBeEnabled();
	await save.click();
	await expect(save).toBeEnabled();

	// Step 3: SPA-navigate to Denver (via the in-app tree link).
	await page.getByRole('link', { name: '↳ Denver Omelette' }).click();
	await expect(page.getByRole('heading', { name: 'Recipe: Denver Omelette' })).toBeVisible();

	// Step 4: add Celery to Denver.
	await page.getByRole('button', { name: 'Add new ingredient' }).click();
	const denverNameInput = page.getByPlaceholder('Name').first();
	await denverNameInput.waitFor({ state: 'visible' });
	await denverNameInput.fill('Celery');
	await page.getByRole('button', { name: 'Add', exact: true }).click();

	// Save Denver.
	const saveDenver = page.getByRole('button', { name: 'Save', exact: true });
	await expect(saveDenver).toBeEnabled();
	await saveDenver.click();
	await expect(saveDenver).toBeEnabled();

	// Step 5: back to Simple. The save didn't leak Celery across recipes
	// — Celery was added to Denver only, so it must not appear on Simple.
	await page.goto('/');
	await page.getByRole('link', { name: 'Simple Omelette', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Recipe: Simple Omelette' })).toBeVisible();

	// Hard reload to bypass the local proxy and read straight from the server.
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Recipe: Simple Omelette' })).toBeVisible();

	// Scope to the ingredient list so the History section's "added
	// ingredient: Peanut butter" / "removed ingredient: Peanut butter"
	// entries don't trip strict-mode (and so they can't be used to paper
	// over a bug where the change is recorded but not applied to the body).
	const ingredientList = page.getByTestId('ingredient-list');
	await expect(ingredientList.getByText('Peanut butter')).toHaveCount(1);
	await expect(ingredientList.getByText('Celery')).toHaveCount(0);
});