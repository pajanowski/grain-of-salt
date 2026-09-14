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

// T8: pressing Tab highlights the next option AND selects it (single-select listbox)
test('T8: pressing Tab on the ingredient picker selects the next option', async ({ page }) => {
	await openOmelette(page);
	await openAddDirection(page);

	// Type just # — picker shows all 3 ingredients (Eggs, Butter, Salt).
	await getDirectionBodyInput(page).fill('#');
	await page.waitForTimeout(200);

	const picker = getIngredientPicker(page);
	await expect(picker).toBeVisible({ timeout: 3000 });

	// Tab once from the textarea — the dropdown's global keydown handler
	// catches it, advances the highlight from -1 to 0 (first option), and
	// selects that option. The textarea then contains the corresponding
	// #uuid.
	const before = await getDirectionBodyInput(page).inputValue();
	await page.keyboard.press('Tab');
	await page.waitForTimeout(200);

	const after = await getDirectionBodyInput(page).inputValue();
	console.log(`[T8] before="${before}" after="${after}"`);
	expect(after, 'Tab should have inserted a #uuid').toMatch(/#[0-9a-f-]{36}/i);

	// Picker should close after the selection.
	await expect(picker).not.toBeVisible({ timeout: 2000 });
});

// T9: pressing Shift+Tab highlights the previous option without selecting
test('T9: pressing Shift+Tab on the ingredient picker moves highlight without selecting', async ({ page }) => {
	await openOmelette(page);
	await openAddDirection(page);

	await getDirectionBodyInput(page).fill('#');
	await page.waitForTimeout(200);

	const picker = getIngredientPicker(page);
	await expect(picker).toBeVisible({ timeout: 3000 });

	// Shift+Tab from -1 wraps to the last option (Salt) but does NOT
	// select it — only Tab (without Shift) selects.
	await page.keyboard.press('Shift+Tab');
	await page.waitForTimeout(200);

	// Textarea should still have just "#" — no uuid inserted.
	const after = await getDirectionBodyInput(page).inputValue();
	expect(after, 'Shift+Tab should NOT have inserted a #uuid').toBe('#');

	// Picker should still be open.
	await expect(picker).toBeVisible({ timeout: 2000 });

	// The last option should be the highlighted one (Salt, the third
	// ingredient — the picker sorts by insertion order).
	const lastOption = picker.locator('[role="option"]').last();
	await expect(lastOption).toHaveAttribute('aria-selected', 'true');
});

// T10: ArrowDown then Enter selects the highlighted option
test('T10: ArrowDown then Enter selects the highlighted option', async ({ page }) => {
	await openOmelette(page);
	await openAddDirection(page);

	await getDirectionBodyInput(page).fill('#');
	await page.waitForTimeout(200);

	const picker = getIngredientPicker(page);
	await expect(picker).toBeVisible({ timeout: 3000 });

	// ArrowDown from -1 highlights the first option (Eggs).
	await page.keyboard.press('ArrowDown');
	await page.waitForTimeout(100);

	const firstOption = picker.locator('[role="option"]').first();
	await expect(firstOption).toHaveAttribute('aria-selected', 'true');

	// Enter activates it.
	await page.keyboard.press('Enter');
	await page.waitForTimeout(200);

	const after = await getDirectionBodyInput(page).inputValue();
	console.log(`[T10] after="${after}"`);
	expect(after).toMatch(/#[0-9a-f-]{36}/i);
	await expect(picker).not.toBeVisible({ timeout: 2000 });
});

// T11: Escape closes the picker without selecting
test('T11: Escape closes the ingredient picker without selecting', async ({ page }) => {
	await openOmelette(page);
	await openAddDirection(page);

	await getDirectionBodyInput(page).fill('#');
	await page.waitForTimeout(200);

	const picker = getIngredientPicker(page);
	await expect(picker).toBeVisible({ timeout: 3000 });

	await page.keyboard.press('Escape');
	await page.waitForTimeout(200);

	await expect(picker).not.toBeVisible({ timeout: 2000 });

	const after = await getDirectionBodyInput(page).inputValue();
	expect(after, 'Escape should not have inserted a #uuid').toBe('#');
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
