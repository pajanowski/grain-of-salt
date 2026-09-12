/**
 * E2E tests for unit autocomplete, normalization, and display pluralization.
 *
 * Each test creates its own recipe via the standard UI flow so tests are
 * fully hermetic and require no database seeding.
 */
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
  createRecipeWithIngredient,
  getRowSaveButton,
  clickRowAction,
} from './helpers/page-utils';

// ------------------------------------------------------------------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------------------------------------------------------------------

/** Find the Unit input inside the edit form (UnitAutocomplete renders a textbox with aria-label="Unit"). */
function getUnitInput(scope: import('@playwright/test').Locator | import('@playwright/test').Page) {
  return scope.getByRole('textbox', { name: 'Unit' });
}

// ------------------------------------------------------------------------------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------------------------------------------------------------------------------

test.describe('unit autocomplete & normalization', () => {

  // 1. Typing a synonym and pressing Enter selects the canonical form
  test('autocomplete selects canonical "cup" when typing "cups"', async ({ page }) => {
    const recipeName = uuidv4();
    await createRecipeWithIngredient(page, recipeName, 'Flour', '2', 'cups');

    // Open Edit form
    await clickRowAction(page, page.getByTestId('ingredient-row').filter({ hasText: 'Flour' }), 'Edit');
    const editForm = page.getByTestId('ingredient-row').getByText('Save Cancel')

    // Update amount and change unit via autocomplete
    const amountInput = page.getByTestId('ingredient-row').getByRole('textbox', { name: 'Amount (e.g. 1/3, 1 1/2)' })
    const unitInput = page.getByTestId('ingredient-row').getByRole('textbox', { name: 'Unit' })
    await amountInput.fill('2');
    await unitInput.fill('cups');

    // Dropdown should appear
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 5000 });

    // Select via Enter — should show canonical "cup"
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(unitInput).toHaveValue('cup');

    // Save the row
    await getRowSaveButton(editForm).click();

    // Verify normalized unit persisted
    await expect(page.getByTestId('ingredient-row').filter({ hasText: 'Flour' })).toBeVisible();
  });

  // 2. Custom units pass through unchanged
  test('custom unit "furlongs per fortnight" passes through', async ({ page }) => {
    const recipeName = uuidv4();
    await createRecipeWithIngredient(page, recipeName, 'Mystery Spice', '1', 'furlongs per fortnight');

    // Edit the ingredient
    await clickRowAction(page, page.getByTestId('ingredient-row').filter({ hasText: 'Mystery Spice' }), 'Edit');
    const editForm = page.getByTestId('ingredient-row').getByText('Save Cancel')

    const unitInput = page.getByTestId('ingredient-row').getByRole('textbox', { name: 'Unit' })
    await unitInput.click();
    await unitInput.fill('furlongs per fortnight');

    // No suggestions should appear (no match in CANONICAL_UNITS)
    await expect(page.getByText('No matches for "furlongs per')).toBeVisible();

    // Save
    await getRowSaveButton(editForm).click();

    // Verify it persisted exactly as typed
    await expect(page.getByTestId('ingredient-row').filter({ hasText: 'Mystery Spice' }).getByText('furlongs per fortnight')).toBeVisible();
  });

  // 3. TABLESPOONS normalizes to tablespoon on save (via keyboard selection)
  test('TABLESPOONS normalizes to tablespoon via keyboard selection', async ({ page }) => {
    const recipeName = uuidv4();
    await createRecipeWithIngredient(page, recipeName, 'Butter', '2', 'tablespoons');

    await clickRowAction(page, page.getByTestId('ingredient-row').filter({ hasText: 'Butter' }), 'Edit');
    const editForm = page.getByTestId('ingredient-row').getByText('Save Cancel');

    const unitInput = page.getByTestId('ingredient-row').getByRole('textbox', { name: 'Unit' });
    await unitInput.click();
    await unitInput.fill('tablespoons');
    // Open dropdown and select via Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Should normalize to canonical lowercase

    // Save
    await getRowSaveButton(editForm).click();

    // Verify display shows canonical form
    await expect(page.getByTestId('ingredient-row').filter({ hasText: 'Butter' }).getByText('tablespoon')).toBeVisible();
    await clickRowAction(page, page.getByTestId('ingredient-row').filter({ hasText: 'Butter' }), 'Edit');
    await expect(unitInput).toHaveValue('tablespoon');
  });

  // 4. Typing a synonym and blurring away (no explicit dropdown selection) also normalizes
  test('typing synonym and blurring without selection normalizes the value', async ({ page }) => {
    const recipeName = uuidv4();
    await createRecipeWithIngredient(page, recipeName, 'Salt', '1', 'cups');

    await clickRowAction(page, page.getByTestId('ingredient-row').filter({ hasText: 'Salt' }), 'Edit');
    const editForm = page.getByTestId('ingredient-row').getByText('Save Cancel');

    const unitInput = page.getByTestId('ingredient-row').getByRole('textbox', { name: 'Unit' });
    await unitInput.click();
    await unitInput.fill('TABLESPOONS');
    // Open dropdown and select via Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Should still normalize to canonical form even without explicit selection

    // Save
    await getRowSaveButton(editForm).click();

    // Verify display shows canonical form
    // await expect(page.getByTestId('ingredient-row').filter({ hasText: 'Salt' }).getByText('tablespoon')).toBeVisible();
    await clickRowAction(page, page.getByTestId('ingredient-row').filter({ hasText: 'Salt' }), 'Edit');
    await expect(unitInput).toHaveValue('tablespoon');
  });

  // 5. Display pluralization in read-only mode
  test('read-only displays singular (1 cup) vs plural (2 cups)', async ({ page }) => {
    // Singular — 1 cup
    const singularRecipe = uuidv4();
    await createRecipeWithIngredient(page, singularRecipe, 'Egg', '1', 'cup');
    await expect(page.getByTestId('ingredient-row').filter({ hasText: 'Egg' })).toBeVisible();
    await expect(page.getByTestId('ingredient-row').filter({ hasText: 'Egg' }).getByText('1 cup')).toBeVisible();

    // Plural — 2 cups
    const pluralRecipe = uuidv4();
    await createRecipeWithIngredient(page, pluralRecipe, 'Sugar', '2', 'cups');
    await expect(page.getByTestId('ingredient-row').filter({ hasText: 'Sugar' })).toBeVisible();
    await expect(page.getByTestId('ingredient-row').filter({ hasText: 'Sugar' }).getByText('2 cups')).toBeVisible();
  });
});
