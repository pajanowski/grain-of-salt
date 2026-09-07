/**
 * E2E tests for deleting a recipe from its detail page.
 *
 * The test creates a recipe via the home page form with a uuid name,
 * navigates to its detail page, opens the recipe actions menu, clicks
 * "Delete recipe", accepts the browser confirm dialog, and asserts the
 * recipe is gone from the list and returns 404 at its detail URL.
 *
 * Auth: individual tests boot already authenticated via
 * `use.storageState` in playwright.config.ts — see global-setup.ts.
 */
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
  openCreateForm,
  getRecipeNameInput,
  getCreateButton,
  getRecipeLink
} from './helpers/page-utils';

test('delete recipe removes it from the list and returns 404', async ({ page }) => {

  const recipeName = uuidv4();

  // Create the recipe via the home page form
  await page.goto('/');
  await openCreateForm(page);
  await getRecipeNameInput(page).fill(recipeName);
  await getCreateButton(page).click();
  await expect(getRecipeLink(page, recipeName)).toBeVisible();

  // Navigate to the recipe detail page
  const recipeLink = getRecipeLink(page, recipeName);
  await recipeLink.click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]+/);
  const recipeUrl = page.url();

  // Accept the browser confirm dialog that "Delete recipe" fires
  page.on('dialog', (dialog) => dialog.accept());

  // Open the recipe actions menu and click "Delete recipe"
  // The trigger button has aria-label="Recipe actions"
  const actionsButton = page.getByRole('button', { name: 'Recipe actions' });
  await actionsButton.click();
  await page.getByRole('menuitem', { name: 'Delete recipe' }).click();

  // Assert the recipe link is gone from the home page list
  await expect(page).toHaveURL('/');
  await expect(getRecipeLink(page, recipeName)).not.toBeVisible();

  // Assert navigating directly to the recipe URL returns 404
  await page.goto(recipeUrl);
  await expect(page.getByText('Recipe not found')).toBeVisible();
});
