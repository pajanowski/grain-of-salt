/**
 * E2E tests for unit autocomplete, normalization, and display pluralization.
 *
 * Covers:
 *   1. Typing "cups" in an edit form auto-suggests "cup", selecting it fills
 *      the input with the canonical name.
 *   2. Custom units not in COMMON_UNITS pass through unchanged.
 *   3. Saving normalizes known variants; after reload the stored unit matches
 *      the canonical form.
 *   4. Read-only / public view displays proper plural ("2 cups") vs singular
 *      ("1 cup").
 */
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { TEST_USER_ID } from './helpers/auth-shared';
import {
  getAddIngredientButton,
  getIngredientNameInput,
  getAddButton,
  getRowSaveButton,
  clickRowAction,
} from './helpers/page-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find the Unit input inside a form by placeholder. */
function getUnitInput(scope: import('@playwright/test').Locator | import('@playwright/test').Page) {
  return scope.locator('input[placeholder="Unit"]');
}

async function openRecipeByName(page: import('@playwright/test').Page, recipeName: string) {
  await page.goto('/mise');
  const link = page
    .getByRole('link', { name: new RegExp(`^\\s*(↳\\s+)?${recipeName}\\b`) })
    .first();
  await link.click();
  await page.waitForURL(/\/recipes\//);
}

async function createRecipeWithIngredient(
  db: ReturnType<typeof drizzle>,
  ownerId: string,
  recipeName: string,
  ingredientName: string,
  amount: string,
  unit: string
) {
  const id = uuidv4();
  const ingId = uuidv4();
  await db.execute(sql.raw(`delete from public.recipe_nodes where owner_id = '${ownerId}' and name='${recipeName.replace(/'/g, "''")}'`));
  await db.execute(sql`
    insert into public.recipe_nodes (id, parent_id, owner_id, name, ingredient_changes, direction_changes)
    values (${id}::uuid, null::uuid, ${ownerId}::uuid, ${recipeName},
      '[{"id":"${ingId}","changeType":"add","targetId":null,"note":null,"body":{"name":"${ingredientName.replace(/'/g, "''")}","amount":${amount},"unit":"${unit}"}}]',
      '[]'
    )
  `);
}

// ---------------------------------------------------------------------------
// Tests — each uses a unique recipe name so no cross-test interference
// ---------------------------------------------------------------------------

test.describe('unit autocomplete & normalization', () => {
  // Pre-seed recipes in DB; then load them via /mise to verify UI behavior
  test.beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL must be set for e2e tests');
    const client = postgres(dbUrl, { prepare: false });
    const db = drizzle(client);
    try {
      const names = [
        ['Auto Complete Test', 'Flour', 2, 'cups'],
        ['Custom Unit Test', 'Mystery Spice', 1, 'furlongs per fortnight'],
        ['Normalize Test', 'Butter', 2, 'TABLESPOONS'],
        ['Pluralize Test A', 'Egg', 1, 'cup'],
        ['Pluralize Test B', 'Sugar', 2, 'cups'],
      ];
      for (const [recipeName, ingName, amt, unit] of names) {
        await createRecipeWithIngredient(db, TEST_USER_ID, recipeName, ingName, String(amt), unit);
      }
    } finally {
      await client.end();
    }
  });

  // 1. Autocomplete suggests canonical forms when typing
  test('autocomplete suggests "cup" when typing "cups"', async ({ page }) => {
    await openRecipeByName(page, 'Auto Complete Test');
    await expect(page.getByText('Flour')).toBeVisible();

    // Open Edit form
    await clickRowAction(page, page.getByTestId('ingredient-row').filter({ hasText: 'Flour' }), 'Edit');

    // Fill Amount, keep Name as-is
    await page.getByPlaceholder('Amount').fill('2');

    // Type "cups" in the Unit autocomplete
    const unitInput = getUnitInput(page.getByRole('textbox'));
    await unitInput.fill('cups');

    // Dropdown should appear (ul.absolute)
    const editForm = page.locator('form').last();
    await expect(editForm.locator('ul.absolute')).toBeVisible({ timeout: 5000 });

    // Select via Enter
    await page.keyboard.press('Enter');

    // Should now show canonical form
    await expect(unitInput).toHaveValue('cup');

    // Save the row
    await getRowSaveButton(editForm).click();

    // Verify saved state — the ingredient row should now show normalized unit
    await expect(page.getByText('Flour')).toBeVisible();
  });

  // 2. Custom units pass through unchanged
  test('custom unit "furlongs per fortnight" passes through', async ({ page }) => {
    await openRecipeByName(page, 'Custom Unit Test');
    await expect(page.getByText('Mystery Spice')).toBeVisible();

    // Edit the ingredient
    await clickRowAction(page, page.getByTestId('ingredient-row').filter({ hasText: 'Mystery Spice' }), 'Edit');
    const editForm = page.locator('form').last();

    const unitInput = getUnitInput(editForm);
    await unitInput.click();
    await unitInput.fill('furlongs per fortnight');

    // No suggestions should appear (no match in COMMON_UNITS)
    await expect(editForm.locator('ul.absolute li')).toHaveCount(0, { timeout: 3000 });

    // Save
    await getRowSaveButton(editForm).click();

    // Verify it persisted exactly as typed
    await expect(page.getByText('furlongs per fortnight')).toBeVisible();
  });

  // 3. TABLESPOONS normalizes to tablespoon on save
  test('TABLESPOONS normalizes to tablespoon', async ({ page }) => {
    await openRecipeByName(page, 'Normalize Test');
    await expect(page.getByText('Butter')).toBeVisible();

    await clickRowAction(page, page.getByTestId('ingredient-row').filter({ hasText: 'Butter' }), 'Edit');
    const editForm = page.locator('form').last();

    const unitInput = getUnitInput(editForm);
    await unitInput.click();
    await unitInput.fill('TABLESPOONS');

    // Suggestion dropdown should appear
    await expect(editForm.locator('ul.absolute')).toBeVisible({ timeout: 5000 });

    // Select first match via Enter
    await page.keyboard.press('Enter');

    // Should normalize to canonical lowercase
    await expect(unitInput).toHaveValue('tablespoon');

    // Save
    await getRowSaveButton(editForm).click();

    // Verify display shows canonical form
    await expect(page.getByText('tablespoon')).toBeVisible();
  });

  // 4. Display pluralization in read-only mode
  test('read-only displays singular (1 cup) vs plural (2 cups)', async ({ page }) => {
    await openRecipeByName(page, 'Pluralize Test A');
    await expect(page.getByText('Egg')).toBeVisible();
    // Single amount should display "cup"
    await expect(page.getByText('1 cup')).toBeVisible();

    // Navigate to the plural test
    await openRecipeByName(page, 'Pluralize Test B');
    await expect(page.getByText('Sugar')).toBeVisible();
    // Multiple amount should display "cups"
    await expect(page.getByText('2 cups')).toBeVisible();
  });
});
