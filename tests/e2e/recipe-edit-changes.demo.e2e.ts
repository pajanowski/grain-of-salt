/**
 * Demo-mode e2e tests for ingredient and direction add/edit/remove
 * (ADR 0003 — Demo suite). Mirror of tests/e2e/recipe-edit-changes.e2e.ts,
 * but exercises the demo adapter (localStorage-backed) instead of the
 * real Supabase backend.
 *
 * The demo fixture uses one of the seeded recipes ("Pancakes") rather
 * than seeding a brand-new 4-node tree under the test user — the demo
 * has no test user. Reset before each test to make the state hermetic.
 */
import { expect, type Page, test } from '@playwright/test';
import {
	getAddButton,
	getAddIngredientButton,
	getAddDirectionButton,
	getIngredientNameInput,
	getDirectionBodyInput,
	getRowSaveButton,
	clickRowAction
} from './helpers/page-utils';

const DEMO_RECIPE = 'Pancakes' as const;

async function resetDemoState(page: Page): Promise<void> {
	await page.goto('/');
	const resetButton = page.getByTestId('reset-demo');
	if (await resetButton.isVisible().catch(() => false)) {
		await resetButton.click();
	}
}

async function openDemoRecipe(page: Page, name: string): Promise<void> {
	await page.goto('/');
	await page.getByRole('link', { name, exact: true }).click();
	await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]+/);
	await expect(page.getByRole('heading', { name })).toBeVisible();
}

function ingredientList(page: Page) {
	return page.getByTestId('ingredient-list');
}

function directionList(page: Page) {
	return page.getByTestId('direction-list');
}

function ingredientRow(page: Page, name: string) {
	return ingredientList(page).locator(`li[data-ingredient-name="${name}"]`);
}

async function fillAddIngredient(
	page: Page,
	name: string,
	amount: string,
	unit: string
): Promise<void> {
	await getAddIngredientButton(page).click();
	await getIngredientNameInput(page).fill(name);
	await page.getByLabel('Amount').fill(amount);
	await page.getByLabel('Unit').fill(unit);
	await getAddButton(page).click();
}

async function fillAddDirection(page: Page, body: string): Promise<void> {
	await getAddDirectionButton(page).click();
	await getDirectionBodyInput(page).fill(body);
	await getAddButton(page).click();
}

async function clickPageSave(page: Page): Promise<void> {
	// Demo path: Save button is gated by hasUnsavedChanges, which
	// depends on a derived diff. Wait for it to be enabled both
	// before and after clicking to avoid overlapping save calls.
	const saveButton = page.getByRole('button', { name: 'Save', exact: true });
	await expect(saveButton).toBeEnabled();
	await saveButton.click();
	await expect(saveButton).toBeHidden();
}

test.beforeEach(async ({ page }) => {
	// The Remove row action shows a window.confirm dialog before applying.
	// Playwright auto-dismisses dialogs (returning false from confirm),
	// which would silently swallow the remove. Register an accept handler.
	page.on('dialog', (dialog) => dialog.accept());
});

test('demo: adding an ingredient shows it in the list and survives a reload', async ({
	page
}) => {
	await resetDemoState(page);
	await openDemoRecipe(page, DEMO_RECIPE);

	const newName = 'DemoTestSalt';
	await fillAddIngredient(page, newName, '1', 'pinch');
	await expect(ingredientRow(page, newName)).toBeVisible();

	await clickPageSave(page);

	// Reload — localStorage persists the change.
	await page.reload();
	await openDemoRecipe(page, DEMO_RECIPE);
	await expect(ingredientRow(page, newName)).toBeVisible();
});

test('demo: adding a direction shows it in the list and survives a reload', async ({
	page
}) => {
	await resetDemoState(page);
	await openDemoRecipe(page, DEMO_RECIPE);

	const newBody = 'Demo test stir gently.';
	await fillAddDirection(page, newBody);
	const rows = directionList(page).locator('li');
	await expect(rows.filter({ hasText: newBody })).toBeVisible();

	await clickPageSave(page);

	await page.reload();
	await openDemoRecipe(page, DEMO_RECIPE);
	await expect(directionList(page).locator('li').filter({ hasText: newBody })).toBeVisible();
});

test('demo: removing an ingredient deletes it from the list', async ({ page }) => {
	await resetDemoState(page);
	await openDemoRecipe(page, DEMO_RECIPE);

	const targetName = 'DemoRemoveMe';
	await fillAddIngredient(page, targetName, '2', 'cup');
	await expect(ingredientRow(page, targetName)).toBeVisible();

	await clickPageSave(page);
	await page.reload();
	await openDemoRecipe(page, DEMO_RECIPE);

	await clickRowAction(page, ingredientRow(page, targetName), 'Remove');
	await expect(ingredientRow(page, targetName)).toHaveCount(0);

	await clickPageSave(page);
	await page.reload();
	await openDemoRecipe(page, DEMO_RECIPE);
	await expect(ingredientRow(page, targetName)).toHaveCount(0);
});

test('demo: editing an ingredient updates the value in the list', async ({ page }) => {
	await resetDemoState(page);
	await openDemoRecipe(page, DEMO_RECIPE);

	const targetName = 'DemoEditMe';
	await fillAddIngredient(page, targetName, '1', 'tsp');
	await clickPageSave(page);

	await page.reload();
	await openDemoRecipe(page, DEMO_RECIPE);

	const row = ingredientRow(page, targetName);
	await clickRowAction(page, row, 'Edit');
	// Edit mode replaces the row's inputs in-place.
	const nameInput = row.getByLabel('Ingredient name');
	await nameInput.fill('DemoRenamed');
	await getRowSaveButton(row).click();

	await expect(ingredientRow(page, 'DemoRenamed')).toBeVisible();
	await expect(ingredientRow(page, targetName)).toHaveCount(0);

	await clickPageSave(page);
	await page.reload();
	await openDemoRecipe(page, DEMO_RECIPE);
	await expect(ingredientRow(page, 'DemoRenamed')).toBeVisible();
});
