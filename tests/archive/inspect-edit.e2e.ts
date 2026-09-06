import { expect, type Page, test } from '@playwright/test';

async function openRecipe(page: Page, recipeName: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Recipe List' })).toBeVisible();
  const link = page
    .getByRole('link', { name: new RegExp(`^\\s*(↳\\s+)?${recipeName}\\b`) })
    .first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL(/\/recipes\//);
  await expect(page.getByRole('heading', { name: `Recipe: ${recipeName}` })).toBeVisible();
}

function ingredientList(page: Page) {
  return page.getByTestId('ingredient-list');
}

function ingredientRow(page: Page, name: string) {
  return ingredientList(page).locator(`li[data-ingredient-name="${name}"]`);
}

test('debug edit flow', async ({ page }) => {
  await openRecipe(page, 'Test Sibling A');

  const row = ingredientRow(page, 'Eggs');
  console.log('Row found:', await row.count());

  // Click the actions button
  await row.getByRole('button', { name: /^Actions for/ }).click();
  await page.waitForTimeout(300);

  // Take screenshot before clicking menu
  await page.screenshot({ path: '/tmp/debug-menu.png', fullPage: true });

  // Click Edit menu item
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/tmp/debug-edit-form.png', fullPage: true });

  // Check if edit form is visible
  const editForm = row.locator('form');
  console.log('Edit form count:', await editForm.count());

  // Fill new values
  await row.getByPlaceholder('Amount').fill('5');

  // Screenshot before save
  await page.screenshot({ path: '/tmp/debug-edit-filled.png', fullPage: true });
  // Fill only Name (test hypothesis)
  await row.getByPlaceholder('Name').fill('Eggs');
  await page.screenshot({ path: '/tmp/debug-after-row-save.png', fullPage: true });

  // Check page Save state
  const pageSave = page.getByRole('button', { name: 'Save', exact: true });
  console.log('Page Save disabled:', await pageSave.isDisabled());

  // Dump the Save button HTML
  const saveHtml = await pageSave.evaluate((el) => el.outerHTML);
  console.log('Page Save HTML:', saveHtml);
});
