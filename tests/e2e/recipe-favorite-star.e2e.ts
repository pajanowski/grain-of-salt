/**
 * E2E test for the favorite star on the recipe header.
 *
 * Per the favorite feature spec: "A favorited recipe puts a star next to
 * the name where ever its name is displayed." Slice #2 covers the
 * recipe detail header — the most prominent place the recipe name is
 * shown to its owner.
 *
 * Drives the favorite toggle entirely through the recipe actions menu
 * (same UI path as slice #1) and asserts on a visible star icon next
 * to the `<h1>`. The star must:
 *   - NOT be present when the recipe is not favorited.
 *   - Appear next to the recipe name after favoriting via the menu.
 *   - Disappear again after unfavoriting via the menu.
 *
 * No direct DB connection — AGENTS.md says tests should drive state
 * through the UI.
 */
import { expect, test } from '@playwright/test';
import {
	openCreateForm,
	getRecipeNameInput,
	getCreateButton,
	getRecipeLink
} from './helpers/page-utils';

test('favorited recipe shows a star next to its name on the recipe header', async ({ page }) => {
	const recipeName = crypto.randomUUID();

	// Create the recipe through the UI.
	await page.goto('/mise');
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(recipeName);
	await getCreateButton(page).click();
	const link = getRecipeLink(page, recipeName);
	await expect(link).toBeVisible();
	await link.click();
	await expect(page).toHaveURL(/\/mise\/recipes\/[0-9a-f-]+/);

	// Locate the recipe title heading. The star is rendered as a
	// decorative lucide icon, so assert via the heading's accessible
	// name once the star is present (the SVG contributes nothing to
	// the accessible name when aria-hidden, so we assert on a
	// dedicated testid scoped to the star instead — see Recipe.svelte).
	const heading = page.getByRole('heading', { name: recipeName, level: 1 });
	await expect(heading).toBeVisible();

	// Before favoriting: no star next to the heading.
	await expect(page.getByTestId('recipe-favorite-star')).toHaveCount(0);

	// Favorite via the actions menu.
	const favoriteResponse = page.waitForResponse(
		(r) =>
			r.url().includes('/mise/api/recipe-node/') &&
			r.url().endsWith('/favorite') &&
			r.request().method() === 'PATCH'
	);
	await page.getByRole('button', { name: 'Recipe actions' }).click();
	await page.getByRole('menuitem', { name: 'Favorite' }).click();
	await favoriteResponse;

	// After favoriting: a star appears next to the recipe name.
	const star = page.getByTestId('recipe-favorite-star');
	await expect(star).toBeVisible();

	// Unfavorite via the menu — the star should disappear again.
	const unfavoriteResponse = page.waitForResponse(
		(r) =>
			r.url().includes('/mise/api/recipe-node/') &&
			r.url().endsWith('/favorite') &&
			r.request().method() === 'PATCH'
	);
	await page.getByRole('button', { name: 'Recipe actions' }).click();
	await page.getByRole('menuitem', { name: 'Unfavorite' }).click();
	await unfavoriteResponse;

	await expect(page.getByTestId('recipe-favorite-star')).toHaveCount(0);
});
