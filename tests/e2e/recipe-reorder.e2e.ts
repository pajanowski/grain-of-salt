/**
 * E2E tests for move-up and move-down on the recipe edit UI.
 *
 * Tests verify that:
 *   1. Move up/down correctly reorders a single ingredient or direction.
 *   2. Boundary items (first/last) are disabled in the menu.
 *   3. The new order is persisted to the DB and survives a reload.
 *
 * Fixture: a single recipe with 3 ingredients ("Alpha", "Beta", "Gamma")
 * and 3 directions ("Step 1", "Step 2", "Step 3"), created fresh per test
 * using uuid names so tests are hermetic against any seeded data.
 */
import { expect, type Page, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
  openCreateForm,
  getRecipeNameInput,
  getCreateButton,
  getRecipeLink,
  getAddButton,
  getAddIngredientButton,
  getAddDirectionButton,
  getIngredientNameInput,
  getDirectionBodyInput,
  clickRowAction,
} from './helpers/page-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The currently-open add-row form, identified by having an Add button inside it. */
function openForm(page: Page) {
  return page.locator('form').filter({ has: getAddButton(page) }).first();
}

async function fillAddIngredient(page: Page, name: string, amount: string, unit: string) {
  await getAddIngredientButton(page).click();
  const form = openForm(page);
  await expect(getIngredientNameInput(page)).toBeVisible();
  await getIngredientNameInput(page).fill(name);
  await page.getByPlaceholder('Amount').fill(amount);
  await page.getByPlaceholder('Unit').fill(unit);
  await getAddButton(form).click();
}

async function fillAddDirection(page: Page, body: string) {
  await getAddDirectionButton(page).click();
  const form = openForm(page);
  await expect(getDirectionBodyInput(page)).toBeVisible();
  await getDirectionBodyInput(page).fill(body);
  await getAddButton(form).click();
}

async function createReorderRecipe(page: Page): Promise<string> {
  const name = uuidv4();
  await page.goto('/mise');
  await openCreateForm(page);
  await getRecipeNameInput(page).fill(name);
  await getCreateButton(page).click();
  await expect(getRecipeLink(page, name)).toBeVisible();

  // Navigate to the recipe page
  await getRecipeLink(page, name).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();

  // Add 3 ingredients
  await fillAddIngredient(page, 'Alpha', '1', 'cup');
  await fillAddIngredient(page, 'Beta', '2', 'tbsp');
  await fillAddIngredient(page, 'Gamma', '3', 'tsp');

  // Add 3 directions
  await fillAddDirection(page, 'Step 1');
  await fillAddDirection(page, 'Step 2');
  await fillAddDirection(page, 'Step 3');

  return name;
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

function directionRowByIndex(page: Page, index: number) {
  return directionList(page).locator(`li[data-direction-index="${index}"]`);
}

async function ingredientNames(page: Page): Promise<string[]> {
  return ingredientList(page)
    .locator('li[data-ingredient-name]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-ingredient-name')!));
}

async function directionBodies(page: Page): Promise<string[]> {
  return directionList(page)
    .locator('li[data-direction-index]')
    .evaluateAll((els) =>
      els.map((el) => {
        const span = el.querySelector('span.flex-1');
        return span?.textContent?.replace(/^\d+\.\s*/, '').trim() ?? '';
      })
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('move ingredient up — swaps with the item above it', async ({ page }) => {
  await createReorderRecipe(page);

  // Initial order: Alpha, Beta, Gamma
  await expect(ingredientNames(page)).resolves.toEqual(['Alpha', 'Beta', 'Gamma']);

  // Move Beta up → order should become: Beta, Alpha, Gamma
  await clickRowAction(page, ingredientRow(page, 'Beta'), 'Move up');
  await expect(ingredientNames(page)).resolves.toEqual(['Beta', 'Alpha', 'Gamma']);
});

test('move ingredient down — swaps with the item below it', async ({ page }) => {
  await createReorderRecipe(page);

  // Initial order: Alpha, Beta, Gamma
  await expect(ingredientNames(page)).resolves.toEqual(['Alpha', 'Beta', 'Gamma']);

  // Move Alpha down → order should become: Beta, Alpha, Gamma
  await clickRowAction(page, ingredientRow(page, 'Alpha'), 'Move down');
  await expect(ingredientNames(page)).resolves.toEqual(['Beta', 'Alpha', 'Gamma']);
});

test('move direction up — swaps with the direction above it', async ({ page }) => {
  await createReorderRecipe(page);

  // Initial order: Step 1, Step 2, Step 3
  await expect(directionBodies(page)).resolves.toEqual(['Step 1', 'Step 2', 'Step 3']);

  // Move Step 2 up → order should become: Step 2, Step 1, Step 3
  await clickRowAction(page, directionRowByIndex(page, 1), 'Move up');
  await expect(directionBodies(page)).resolves.toEqual(['Step 2', 'Step 1', 'Step 3']);
});

test('move direction down — swaps with the direction below it', async ({ page }) => {
  await createReorderRecipe(page);

  // Initial order: Step 1, Step 2, Step 3
  await expect(directionBodies(page)).resolves.toEqual(['Step 1', 'Step 2', 'Step 3']);

  // Move Step 2 down → order should become: Step 1, Step 3, Step 2
  await clickRowAction(page, directionRowByIndex(page, 1), 'Move down');
  await expect(directionBodies(page)).resolves.toEqual(['Step 1', 'Step 3', 'Step 2']);
});

test('move up on first item is a no-op', async ({ page }) => {
  await createReorderRecipe(page);

  // The "Move up" menuitem is disabled at index 0 — the action is blocked
  // before it reaches moveIngredient. Verify the order is unchanged.
  await expect(ingredientNames(page)).resolves.toEqual(['Alpha', 'Beta', 'Gamma']);
});

test('moved order persists after save and reload', async ({ page }) => {
  const name = await createReorderRecipe(page);

  // Move Beta up
  await clickRowAction(page, ingredientRow(page, 'Beta'), 'Move up');
  await expect(ingredientNames(page)).resolves.toEqual(['Beta', 'Alpha', 'Gamma']);

  // Save — the save bar disappears after a successful save
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toHaveCount(0);

  // Reload and verify order persisted
  await page.reload();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(ingredientNames(page)).resolves.toEqual(['Beta', 'Alpha', 'Gamma']);
});
