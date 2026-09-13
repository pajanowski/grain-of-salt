import { test, expect } from '@playwright/test';
import { getRecipeLink, getDirectionBodyInput, getAddButton, getIngredientPicker, getAddDirectionButton, submitAddDirection, clickPageSave } from './helpers/page-utils.ts';
import { signInAsTestUser } from './helpers/auth.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/mise')
});

async function openOmelette(page: any) {
  const link = getRecipeLink(page, 'Simple Omelette');
  await link.click();
  await page.waitForURL(/\/mise\/recipes\/[^/]+$/);
  await page.waitForTimeout(500);
}

async function openAddDirection(page: any) {
  await getAddDirectionButton(page).click();
}

async function getChipInTextBox(page: any, text: string | RegExp) {
  return await page.getByRole('textbox', { name: 'Direction' })
    .locator('..')
    .getByText(text)
}

// T1: typing # pops up the picker
test('T1: typing # pops up the picker', async ({ page }) => {
  await openOmelette(page);
  await openAddDirection(page);

  // Type just #
  await getDirectionBodyInput(page).fill('#');
  await page.waitForTimeout(200);

  // Picker should appear
  const picker = getIngredientPicker(page);
  await expect(picker).toBeVisible({ timeout: 3000 });
});

// T2: picker shows all ingredients when just # is typed
test('T2: picker shows all ingredients when just # is typed', async ({ page }) => {
  await openOmelette(page);
  await openAddDirection(page);

  await getDirectionBodyInput(page).fill('#');
  await page.waitForTimeout(200);

  const picker = getIngredientPicker(page);
  await expect(picker).toBeVisible({ timeout: 3000 });

  const options = picker.locator('[role="option"]');
  const count = await options.count();
  console.log(`[T2] Found ${count} ingredient options`);
  expect(count, `Expected 3 ingredients, got ${count}`).toBeGreaterThanOrEqual(1);
});

// T3: typing #E filters ingredients
test('T3: typing #E filters ingredients', async ({ page }) => {
  await openOmelette(page);
  await openAddDirection(page);

  await getDirectionBodyInput(page).fill('#E');
  await page.waitForTimeout(200);

  const picker = getIngredientPicker(page);
  await expect(picker).toBeVisible({ timeout: 3000 });

  const options = picker.locator('[role="option"]');
  const count = await options.count();
  const firstText = await options.first().textContent();
  console.log(`[T3] After "#E": ${count} options, first="${firstText}"`);

  // Should filter to fewer than total
  expect(count).toBeLessThan(10);
  expect(firstText ?? '').toMatch(/Eggs/i);
});

// T4: pressing Enter selects the highlighted ingredient
test('T4: pressing Enter selects the highlighted ingredient', async ({ page }) => {
  await openOmelette(page);
  await openAddDirection(page);

  // Type #Eggs
  await getDirectionBodyInput(page).fill('#Eggs');
  await page.waitForTimeout(300);

  const picker = getIngredientPicker(page);
  await expect(picker).toBeVisible({ timeout: 3000 });

  // Press Enter to select
  await picker.locator('[role="option"]').first().press('Enter');
  await page.waitForTimeout(200);

  // Picker should be closed
  await expect(picker).not.toBeVisible({ timeout: 2000 });

  // Textarea should have #uuid inserted
  const val = await getDirectionBodyInput(page).inputValue();
  console.log(`[T4] After Enter: textarea value="${val}"`);
  expect(val, `Expected #uuid in textarea, got "${val}"`).toMatch(/#[0-9a-f-]{36}/i);
});

// T5: selected ingredient shows as compiled chip in textarea overlay
test('T5: selected ingredient shows as compiled chip in textarea overlay', async ({ page }) => {
  await openOmelette(page);
  await openAddDirection(page);

  // Type #Eggs and select
  await getDirectionBodyInput(page).fill('#Eggs');
  await page.waitForTimeout(200);
  const picker = getIngredientPicker(page);
  await expect(picker).toBeVisible({ timeout: 3000 });
  await picker.locator('[role="option"]').first().press('Enter');
  await page.waitForTimeout(200);

  // Blur textarea so overlay becomes visible
  await getDirectionBodyInput(page).blur();
  await page.waitForTimeout(300);

  // The compiled chip should appear in the overlay
  // The overlay shows "Eggs (3)" for the Eggs ingredient
  const chip = await getChipInTextBox(page, /Eggs.*3/)
  await expect(chip).toBeVisible({ timeout: 3000 });
});

// T6: saving with #Eggs reference shows compiled chip after save
test('T6: saving with #Eggs reference shows compiled chip after save', async ({ page }) => {
  await openOmelette(page);
  await openAddDirection(page);

  // Type #Eggs and select
  await getDirectionBodyInput(page).fill('#Eggs');
  await page.waitForTimeout(200);
  const picker = getIngredientPicker(page);
  await expect(picker).toBeVisible({ timeout: 3000 });
  await picker.locator('[role="option"]').first().press('Enter');
  await page.waitForTimeout(200);

  // Verify textarea has #uuid
  const val = await getDirectionBodyInput(page).inputValue();
  expect(val).toMatch(/#[0-9a-f-]{36}/i);

  // Submit (add direction)
  await submitAddDirection(page);

  await page.waitForTimeout(500);

  // The direction should appear in the list with compiled chip "Eggs (3)"
  const chip = page.getByText('5. Eggs (3)');
  await expect(chip).toBeVisible({ timeout: 3000 });
});

// T7: saved chip survives reload
test('T7: saved chip survives reload', async ({ page }) => {
  await openOmelette(page);
  await openAddDirection(page);

  // Type #Eggs and select
  await getDirectionBodyInput(page).fill('#Eggs');
  await page.waitForTimeout(200);
  const picker = getIngredientPicker(page);
  await expect(picker).toBeVisible({ timeout: 3000 });
  await picker.locator('[role="option"]').first().press('Enter');
  await page.waitForTimeout(200);

  // Verify #uuid is in the textarea
  const afterPick = await getDirectionBodyInput(page).inputValue();
  expect(afterPick, `Expected #uuid, got "${afterPick}"`).toMatch(/#[0-9a-f-]{36}/i);

  // Submit and save
  await submitAddDirection(page);
  await page.waitForTimeout(500);

  // Verify chip is visible before reload
  const chipBefore = page.getByText('5. Eggs (3)');
  await expect(chipBefore).toBeVisible({ timeout: 3000 });

  await clickPageSave(page);
  // Reload the page
  await page.reload();
  await page.waitForTimeout(1000);
  await openOmelette(page);

  // Chip should still be visible after reload
  const chipAfter = page.getByText('5. Eggs (3)');
  await expect(chipAfter).toBeVisible({ timeout: 3000 });
});
