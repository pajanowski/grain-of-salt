import { execSync } from 'node:child_process';
import { test, expect, type Page } from '@playwright/test';

const RECIPE = {
  simple: 'Simple Omelette',
  french: 'French Omelette',
  cheese: 'Cheese Omelette',
  denver: 'Denver Omelette',
} as const;

test.beforeEach(() => {
  execSync('pnpm db:seed', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? '' },
  });
});

if (process.env.PLAYWRIGHT_USE_DEV) {
  test.setTimeout(120_000);
}

async function openRecipe(page: Page, recipeName: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Recipe List' })).toBeVisible();
  const link = page
    .getByRole('link', { name: new RegExp(`^\\s*(↳\\s+)?${recipeName}\\b`) })
    .first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL(/\/recipes\//);
  await expect(
    page.getByRole('heading', { name: `Recipe: ${recipeName}` })
  ).toBeVisible();
}

const MENU_BUTTON = (page: Page) =>
  page.getByRole('button', { name: 'Recipe actions' });

const MENU_ITEM = (page: Page, label: string) =>
  page.getByRole('menuitem', { name: label });

async function openMenu(page: Page) {
  await MENU_BUTTON(page).click();
}

async function createTempRecipe(page: Page, name: string): Promise<string> {
  const res = await page.evaluate(
    (name) => fetch('/api/save', { method: 'POST', body: new URLSearchParams({ recipeName: name }) }),
    name,
  );
  if (!res.ok()) {
    throw new Error(`createTempRecipe failed: ${await res.text()}`);
  }
  return name;
}

// ---------------------------------------------------------------------------
// Delete recipe
// ---------------------------------------------------------------------------
test.skip('delete recipe', () => {
  test('cancelling the confirm dialog does NOT delete the recipe', async ({ page }) => {
    const name = 'Temp for Cancel Delete';
    await createTempRecipe(page, name);
    await openRecipe(page, name);

    page.once('dialog', (d) => d.dismiss());

    await openMenu(page);
    await MENU_ITEM(page, 'Delete recipe').click();

    await expect(page.locator('h1')).toContainText(name);
  });

  test('confirming the delete dialog navigates to home and the recipe is gone', async ({
    page,
  }) => {
    const name = 'Temp for Real Delete';
    await createTempRecipe(page, name);
    await openRecipe(page, name);

    page.once('dialog', (d) => d.accept());

    await openMenu(page);
    await MENU_ITEM(page, 'Delete recipe').click();

    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('Recipes');
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test('delete is a danger action in the three-dot menu', async ({ page }) => {
    await openRecipe(page, RECIPE.simple);
    await openMenu(page);
    const deleteBtn = MENU_ITEM(page, 'Delete recipe');
    await expect(deleteBtn).toBeVisible();
    await expect(deleteBtn).toHaveClass(/text-red-700/);
  });
});

// ---------------------------------------------------------------------------
// Rename recipe
// ---------------------------------------------------------------------------
test.describe('rename recipe', () => {
  test('rename modal opens pre-filled with the current name', async ({ page }) => {
    await openRecipe(page, RECIPE.simple);
    await openMenu(page);
    await MENU_ITEM(page, 'Rename recipe').click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading')).toHaveText('Rename recipe');
    await expect(modal.locator('[data-testid="rename-name-input"]')).toHaveValue(RECIPE.simple);

    await page.keyboard.press('Escape');
  });

  test('cancel closes modal without changing the name', async ({ page }) => {
    await openRecipe(page, RECIPE.simple);
    await openMenu(page);
    await MENU_ITEM(page, 'Rename recipe').click();

    const input = page.locator('[data-testid="rename-name-input"]');
    await expect(input).toHaveValue(RECIPE.simple);

    await page.getByTestId('rename-cancel').click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: `Recipe: ${RECIPE.simple}` })).toBeVisible();
  });

  test('save renames the recipe and closes the modal', async ({ page }) => {
    await openRecipe(page, RECIPE.simple);
    await openMenu(page);
    await MENU_ITEM(page, 'Rename recipe').click();

    const input = page.locator('[data-testid="rename-name-input"]');
    await expect(input).toHaveValue(RECIPE.simple);
    await input.clear();
    await input.fill('Simple Omelette Renamed');

    await page.getByTestId('rename-save').click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recipe: Simple Omelette Renamed' })).toBeVisible();
  });

  test('renamed name persists after page reload', async ({ page }) => {
    await openRecipe(page, RECIPE.simple);
    await openMenu(page);
    await MENU_ITEM(page, 'Rename recipe').click();

    const input = page.locator('[data-testid="rename-name-input"]');
    await expect(input).toHaveValue(RECIPE.simple);
    await input.clear();
    await input.fill('Simple Omelette Reload Test');
    await page.getByTestId('rename-save').click();

    await expect(page.getByRole('heading', { name: 'Recipe: Simple Omelette Reload Test' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Recipe: Simple Omelette Reload Test' })).toBeVisible();
  });
});
// ---------------------------------------------------------------------------
// Fork recipe
// ---------------------------------------------------------------------------
test.describe('fork recipe', () => {
  test('fork entry is enabled in the menu', async ({ page }) => {
    await openRecipe(page, RECIPE.simple);
    await openMenu(page);
    const forkBtn = MENU_ITEM(page, 'Fork recipe');
    await expect(forkBtn).toBeVisible();
    await expect(forkBtn).toBeEnabled();
  });

  test('fork modal opens pre-filled with the current name + (fork)', async ({ page }) => {
    await openRecipe(page, RECIPE.simple);
    await openMenu(page);
    await MENU_ITEM(page, 'Fork recipe').click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading')).toHaveText('Fork recipe');
    await expect(modal.locator('[data-testid="fork-name-input"]')).toHaveValue(
      'Simple Omelette (fork)'
    );

    await page.keyboard.press('Escape');
  });

  test('cancel closes fork modal without creating a recipe', async ({ page }) => {
    await openRecipe(page, RECIPE.simple);
    await openMenu(page);
    await MENU_ITEM(page, 'Fork recipe').click();

    await page.getByTestId('fork-cancel').click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: `Recipe: ${RECIPE.simple}` })).toBeVisible();
  });

  test('save creates a new recipe and navigates to it', async ({ page }) => {
    await openRecipe(page, RECIPE.simple);
    await openMenu(page);
    await MENU_ITEM(page, 'Fork recipe').click();

    const input = page.locator('[data-testid="fork-name-input"]');
    await input.clear();
    await input.fill('My Forked Simple');
    await page.getByTestId('fork-save').click();

    await expect(page).toHaveURL(/\/recipes\/[a-f0-9-]+$/);
    await expect(page.getByRole('heading', { name: 'Recipe: My Forked Simple' })).toBeVisible();
  });

  test('forking French Omelette (a recipe with a parent) works', async ({ page }) => {
    await openRecipe(page, RECIPE.french);
    await openMenu(page);
    await MENU_ITEM(page, 'Fork recipe').click();

    const input = page.locator('[data-testid="fork-name-input"]');
    await input.clear();
    await input.fill('French Omelette V2');
    await page.getByTestId('fork-save').click();

    await expect(page).toHaveURL(/\/recipes\/[a-f0-9-]+$/);
    await expect(page.getByRole('heading', { name: 'Recipe: French Omelette V2' })).toBeVisible();
  });
});
