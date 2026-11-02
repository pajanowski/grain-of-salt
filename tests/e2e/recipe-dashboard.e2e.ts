/**
 * E2E tests for the recent recipes dashboard on the home screen (/mise).
 */
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
	openCreateForm,
	getRecipeNameInput,
	getCreateButton,
	getDashboardCard,
	getFavoriteCard,
	getHeaderHomeLink,
	getRecipeHeading,
	getRecipeLink,
	fillAddIngredient,
	forkRecipe
} from './helpers/page-utils';

test('dashboard displays recently created recipes with links to their leaf node and header home link works', async ({
	page
}) => {
	await page.goto('/mise');

	const recipeName = uuidv4();

	// Create a new recipe from the home page
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(recipeName);
	await getCreateButton(page).click();

	// Navigate to recipe detail page
	const recipeLink = getRecipeLink(page, recipeName);
	await expect(recipeLink).toBeVisible();
	await recipeLink.click();
	await expect(page).toHaveURL(/\/mise\/recipes\/[0-9a-f-]+/);

	// Clicking the Grain of Salt header link returns to /mise
	const homeLink = getHeaderHomeLink(page);
	await expect(homeLink).toBeVisible();
	await homeLink.click();
	await expect(page).toHaveURL('/mise');

	// The recent recipes heading and card should be visible
	await expect(page.getByRole('heading', { name: 'Recent recipes' })).toBeVisible();
	const card = getDashboardCard(page, recipeName);
	await expect(card).toBeVisible();

	// Recipe list is also on the home page beneath recents
	await expect(page.getByRole('heading', { name: 'Recipe List' })).toBeVisible();
	await expect(getRecipeLink(page, recipeName)).toBeVisible();

	// Clicking the dashboard card navigates to the recipe detail page
	await card.click();
	await expect(page).toHaveURL(/\/mise\/recipes\/[0-9a-f-]+/);
	await expect(getRecipeHeading(page, recipeName)).toBeVisible();
});

test('dashboard displays favorites above recents when recipes are favorited', async ({ page }) => {
	await page.goto('/mise');

	const recipeName = uuidv4();

	// Create recipe
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(recipeName);
	await getCreateButton(page).click();

	// Navigate to recipe detail and favorite it
	const link = getRecipeLink(page, recipeName);
	await link.click();
	await expect(page).toHaveURL(/\/mise\/recipes\/[0-9a-f-]+/);

	const favoriteResponse = page.waitForResponse(
		(r) =>
			r.url().includes('/mise/api/recipe-node/') &&
			r.url().endsWith('/favorite') &&
			r.request().method() === 'PATCH'
	);
	await page.getByRole('button', { name: 'Recipe actions' }).click();
	await page.getByRole('menuitem', { name: 'Favorite' }).click();
	await favoriteResponse;

	// Go back home via header link
	await getHeaderHomeLink(page).click();
	await expect(page).toHaveURL('/mise');

	// Favorites heading and card should be visible
	await expect(page.getByRole('heading', { name: 'Favorites' })).toBeVisible();
	const favCard = getFavoriteCard(page, recipeName);
	await expect(favCard).toBeVisible();

	// Recents should also be visible beneath favorites
	await expect(page.getByRole('heading', { name: 'Recent recipes' })).toBeVisible();
	await expect(getDashboardCard(page, recipeName)).toBeVisible();

	// Recipe List should be visible beneath recents
	await expect(page.getByRole('heading', { name: 'Recipe List' })).toBeVisible();
});

test('dashboard displays fork count, displays the newest fork name, and links to the newest leaf when a recipe is forked', async ({
	page
}) => {
	await page.goto('/mise');

	const recipeName = uuidv4();

	// Create root recipe
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(recipeName);
	await getCreateButton(page).click();

	// Navigate to home and verify root recipe is in dashboard
	await page.goto('/mise');
	const card = getDashboardCard(page, recipeName);
	await expect(card).toBeVisible();

	// Navigate into the recipe
	await card.click();
	await expect(getRecipeHeading(page, recipeName)).toBeVisible();

	// Fork the recipe to create a child fork with a distinct name
	const forkedName = await forkRecipe(page, () => `Forked ${uuidv4()}`);

	// Return to home page
	await page.goto('/mise');

	// The dashboard should now display the forked recipe's name instead of the root recipe name
	const forkedCard = getDashboardCard(page, forkedName);
	await expect(forkedCard).toBeVisible();
	await expect(forkedCard).toContainText('1 fork');

	// The root recipe name card should not be directly visible in the dashboard cards
	const rootCard = getDashboardCard(page, recipeName);
	await expect(rootCard).not.toBeVisible();

	// Clicking the forked recipe card links directly to the forked leaf node
	await forkedCard.click();
	await expect(page).toHaveURL(/\/mise\/recipes\/[0-9a-f-]+/);
	await expect(getRecipeHeading(page, forkedName)).toBeVisible();
});

test('dashboard limits recent recipes section to at most 5 recipes', async ({ page }) => {
	await page.goto('/mise');

	// Create 6 recipes
	const createdNames: string[] = [];
	for (let i = 0; i < 6; i++) {
		const name = `Recent Test ${i} ${uuidv4()}`;
		createdNames.push(name);
		await openCreateForm(page);
		await getRecipeNameInput(page).fill(name);
		await getCreateButton(page).click();
		await expect(getRecipeLink(page, name)).toBeVisible();
	}

	await page.goto('/mise');

	// The recent recipes section should display at most 5 cards
	const dashboardCards = page.getByTestId('recipe-dashboard-card');
	const count = await dashboardCards.count();
	expect(count).toBeLessThanOrEqual(5);

	// The most recently created recipe (the 6th one, index 5) must be present
	const latestName = createdNames[5];
	await expect(getDashboardCard(page, latestName)).toBeVisible();

	// The oldest created recipe (index 0) should have dropped out of the top 5 recents
	const oldestName = createdNames[0];
	await expect(getDashboardCard(page, oldestName)).not.toBeVisible();
});
