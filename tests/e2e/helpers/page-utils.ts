/**
 * Shared page-level locators and small helpers used across e2e tests.
 *
 * Anything here must be reusable — keep file-specific form behaviour in
 * its own test file. Generality is the price of being shared.
 */
import { expect, type Locator, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Inline create-recipe form (home page)
// ---------------------------------------------------------------------------

/** Open the inline create-recipe form on the home page and assert the
 * name input is visible. Every create-recipe test starts with this step.
 */
export async function openCreateForm(page: Page) {
  await page.getByRole('button', { name: 'Create Recipe' }).click();
  await expect(page.getByPlaceholder('Recipe name')).toBeVisible();
}

/** The create-recipe form's name input (located by placeholder). */
export function getRecipeNameInput(page: Page) {
  return page.getByPlaceholder('Recipe name');
}

/** The submit button on the create-recipe form (exact "Create"). */
export function getCreateButton(page: Page) {
  return page.getByRole('button', { name: 'Create', exact: true });
}

/** The cancel button on the create-recipe form. */
export function getCancelButton(page: Page) {
  return page.getByRole('button', { name: 'Cancel' });
}

// ---------------------------------------------------------------------------
// Recipe links and headings (recipe list + detail page)
// ---------------------------------------------------------------------------

/** A recipe link in the recipe tree, matched by exact accessible name. */
export function getRecipeLink(page: Page, name: string) {
  return page.getByRole('link', { name, exact: true });
}

/** The "Recipe: <name>" heading on the recipe detail page. */
export function getRecipeHeading(page: Page, name: string) {
  return page.getByRole('heading', { name: `${name}` });
}

// ---------------------------------------------------------------------------
// Add-row forms (recipe detail page — ingredients and directions)
// ---------------------------------------------------------------------------

/**
 * The "Add" submit button inside an add-row form. Takes any locator so
 * the same getter works page-scoped (form filter) and form-scoped (after
 * fill).
 */
export function getAddButton(scope: Page | Locator) {
  return scope.getByRole('button', { name: 'Add', exact: true });
}

// ---------------------------------------------------------------------------
// Per-row actions (ingredient / direction rows)
// ---------------------------------------------------------------------------

/** Per-row actions menu trigger (aria-label starts with "Actions for"). */
export function getRowActionsButton(row: Locator) {
  return row.getByRole('button', { name: /^Actions for/ });
}

/**
 * The "Add" trigger button in the Ingredients section header. Resolved
 * by walking up from the "Ingredients" heading to its flex container and
 * locating the descendant Add button — this disambiguates from the
 * Directions section's identical "Add" button.
 */
export function getAddIngredientButton(page: Page) {
  return page
    .getByText('Ingredients')
    .locator('..')
    .getByRole('button', { name: 'Add', exact: true });
}

/**
 * The "Add" trigger button in the Directions section header. See
 * getAddIngredientButton for the resolution strategy.
 */
export function getAddDirectionButton(page: Page) {
  return page
    .getByText('Directions')
    .locator('..')
    .getByRole('button', { name: 'Add', exact: true });
}

// ---------------------------------------------------------------------------
// Inline add-row form inputs (recipe detail page)
// ---------------------------------------------------------------------------

/**
 * The "Ingredient name" input inside the inline add-ingredient form.
 * Located by accessible name (aria-label on the input).
 */
export function getIngredientNameInput(page: Page) {
  return page.getByRole('textbox', { name: 'Ingredient name' });
}

/**
 * The "Unit" text input inside the inline add-ingredient form.
 * Located by placeholder (the Autocomplete component renders a plain input
 * with placeholder="Unit" for the add form).
 */
export function getAddIngredientUnitInput(page: Page) {
  return page.getByPlaceholder('Unit');
}

/**
 * The currently-open add-ingredient form (has "Ingredient name" input).
 */
function openIngredientForm(page: Page) {
  return page.locator('form').filter({ has: page.getByRole('textbox', { name: 'Ingredient name' }) }).first();
}

/**
 * Fill the inline add-ingredient form and submit it. The form stays open
 * after a successful Add so callers can chain multiple ingredients.
 */
export async function fillAddIngredient(
  page: Page,
  name: string,
  amount: string,
  unit: string
) {
  let form = openIngredientForm(page);
  if ((await form.count()) === 0) {
    await getAddIngredientButton(page).click();
    form = openIngredientForm(page);
  }
  await expect(getIngredientNameInput(page)).toBeVisible();
  await getIngredientNameInput(page).fill(name);
  await page.getByPlaceholder('Amount').fill(amount);
  await getAddIngredientUnitInput(page).fill(unit);
  await getAddButton(form).click();
}

/**
 * Create a recipe, navigate to it, and add one ingredient.
 * Returns the recipe name used.
 */
export async function createRecipeWithIngredient(
  page: Page,
  name: string,
  ingredientName: string,
  amount: string,
  unit: string
): Promise<string> {
  await page.goto('/mise');
  await openCreateForm(page);
  await getRecipeNameInput(page).fill(name);
  await getCreateButton(page).click();
  await expect(getRecipeLink(page, name)).toBeVisible();
  await getRecipeLink(page, name).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await fillAddIngredient(page, ingredientName, amount, unit);
  return name;
}

/**
 * The "Direction" textarea inside the inline add-direction form.
 * Located by accessible name (aria-label on the textarea).
 */
export function getDirectionBodyInput(page: Page) {
  return page.getByRole('textbox', { name: 'Direction' });
}

/** Per-row Save button (Edit-mode submit). */
export function getRowSaveButton(row: Locator) {
  return row.getByRole('button', { name: 'Save', exact: true });
}

/**
 * Open a row's actions menu and click the given action. Same body for
 * ingredient and direction rows — only the row locator differs.
 */
export async function clickRowAction(
  page: Page,
  row: Locator,
  action: 'Edit' | 'Move up' | 'Move down' | 'Remove'
) {
  await getRowActionsButton(row).click();
  await page.getByRole('menuitem', { name: action }).click();
}
/** "Email me a code" or "Sending…" button on the auth page request step. */
export function getAuthSendCodeButton(page: Page) {
	return page.getByRole('button', { name: /Email me a code|Sending/ });
}

/** "Verify" or "Verifying…" button on the auth page verify step. */
export function getAuthVerifyButton(page: Page) {
	return page.getByRole('button', { name: /Verify/ });
}

/** 8-digit OTP code input on the auth page verify step. */
export function getAuthCodeInput(page: Page) {
	return page.getByLabel(/8-digit code/i);
}

/** "Use a different email" button on the auth page verify step. */
export function getAuthUseDifferentEmailButton(page: Page) {
	return page.getByRole('button', { name: 'Use a different email' });
}

/** Email input on the auth page request step. */
export function getAuthEmailInput(page: Page) {
	return page.getByLabel('Email');
}
