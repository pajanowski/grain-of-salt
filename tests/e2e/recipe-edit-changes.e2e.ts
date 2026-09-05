/**
 * E2E tests for ingredient and direction add/edit/remove on the recipe
 * edit UI, verifying that:
 *
 *   1. The correct change TYPE is recorded on the edited node (e.g. an
 *      edit shows as "edited ingredient: before → after", not as
 *      remove + add).
 *   2. The change isolates correctly across a 4-node tree: it appears
 *      on the edited node and its descendants, never on siblings or
 *      ancestors.
 *
 * Materialized recipe building (what each node's "view" actually shows
 * after applying the chain) is out of scope; assertions are on the
 * diff/history view only.
 *
 * Fixture: a 4-node tree seeded by global-setup.ts under the test user:
 *
 *   Test Root
 *   ├── Test Sibling A   (3 ingredients + 3 directions as initial content)
 *   │   └── Test Grandchild
 *   └── Test Sibling B   (empty)
 *
 * Sibling A carries initial content so the edit/remove tests have rows
 * to target. The other three start empty so isolation is unambiguous.
 *
 * All six tests operate on Sibling A as the edit target and cross-check
 * the other three nodes for isolation. Per-test resets are NOT used —
 * the new recipe tree is isolated from other tests, and each test
 * targets a unique entity within Sibling A so the tests don't interfere
 * with each other within the suite.
 */
import { expect, type Page, test } from '@playwright/test';

const RECIPE = {
	root: 'Test Root',
	siblingA: 'Test Sibling A',
	siblingB: 'Test Sibling B',
	grandchild: 'Test Grandchild'
} as const;

/**
 * The fixture tree is re-loaded by global-setup on each suite run; per-test
 * resets would wipe it. The shared `use.storageState` in
 * playwright.config.ts signs every test in without a per-test OTP.
 */

if (process.env.PLAYWRIGHT_USE_DEV) {
	test.setTimeout(120_000);
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Open a recipe page by clicking its link in the recipe tree. Recipes in
 * the tree are matched by name (anchored on the link text), so the same
 * helper works for the 4 fixture nodes and any other recipes in the tree.
 */
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

// ---------------------------------------------------------------------------
// Scoped locators (so we never match history entries that happen to mention
// the same string as an ingredient or direction body).
// ---------------------------------------------------------------------------

function ingredientList(page: Page) {
	return page.getByTestId('ingredient-list');
}

function directionList(page: Page) {
	return page.getByTestId('direction-list');
}

function ingredientRow(page: Page, name: string) {
	return ingredientList(page).locator(`li[data-ingredient-name="${name}"]`);
}

function directionRow(page: Page, index: number) {
	return directionList(page).locator(`li[data-direction-index="${index}"]`);
}

function addIngredientForm(page: Page) {
	return page
		.locator('form')
		.filter({ has: page.getByRole('button', { name: 'Add', exact: true }) })
		.first();
}

async function fillAddIngredient(page: Page, name: string, amount: string, unit: string) {
	await page.getByRole('button', { name: 'Add new ingredient', exact: true }).click();
	const form = addIngredientForm(page);
	await expect(form.getByLabel('Name')).toBeVisible();
	await form.getByLabel('Name').fill(name);
	await form.getByLabel('Amount').fill(amount);
	await form.getByLabel('Unit').fill(unit);
	await form.getByRole('button', { name: 'Add', exact: true }).click();
}

async function fillAddDirection(page: Page, body: string) {
	await page.getByRole('button', { name: 'Add new direction', exact: true }).click();
	const form = addIngredientForm(page);
	await expect(form.getByLabel('Body')).toBeVisible();
	await form.getByLabel('Body').fill(body);
	await form.getByRole('button', { name: 'Add', exact: true }).click();
}

// ---------------------------------------------------------------------------
// Save (page-level). Wait for the ENABLE transition both before clicking
// and after, so we never overlap a save round-trip.
// ---------------------------------------------------------------------------

async function clickPageSave(page: Page) {
	const save = page.getByTestId('save-button');
	await expect(save).toBeEnabled();
	await save.click();
	// Round-trip signal: after a successful save the page reloads data and
	// `hasUnsavedChanges` goes false, which disables the Save button. We
	// wait for that, not for a re-enable (which only happens if the test
	// makes a further edit).
	await expect(save).toBeDisabled();
}
// ---------------------------------------------------------------------------
// Per-row actions. The actions menu button uses an aria-label like
// "Actions for Eggs" (ingredients) or "Actions for direction 1" (directions).
// ---------------------------------------------------------------------------

async function clickIngredientRowAction(
	page: Page,
	row: ReturnType<typeof ingredientRow>,
	action: 'Edit' | 'Move up' | 'Move down' | 'Remove'
) {
	await row.getByRole('button', { name: /^Actions for/ }).click();
	await page.getByRole('menuitem', { name: action }).click();
}

async function clickDirectionRowAction(
	page: Page,
	row: ReturnType<typeof directionRow>,
	action: 'Edit' | 'Move up' | 'Move down' | 'Remove'
) {
	await row.getByRole('button', { name: /^Actions for/ }).click();
	await page.getByRole('menuitem', { name: action }).click();
}

// ---------------------------------------------------------------------------
// Edit row form (per-row inputs, scoped to the row).
// IngredientRow uses placeholder-based inputs; DirectionRow uses a textarea
// with no placeholder or aria-label. The row's own Save button has no
// distinguishing attribute, so it's found by type="submit" within the row.
// ---------------------------------------------------------------------------

async function editIngredientRow(
	page: Page,
	row: ReturnType<typeof ingredientRow>,
	newName: string,
	newAmount: string,
	newUnit: string
) {
	await clickIngredientRowAction(page, row, 'Edit');
	await row.getByPlaceholder('Name').fill(newName);
	await row.getByPlaceholder('Amount').fill(newAmount);
	await row.getByPlaceholder('Unit').fill(newUnit);
	await row.getByRole('button', { name: 'Save', exact: true }).click();
}

async function editDirectionRow(
	page: Page,
	row: ReturnType<typeof directionRow>,
	newBody: string
) {
	await clickDirectionRowAction(page, row, 'Edit');
	await row.locator('textarea').fill(newBody);
	await row.getByRole('button', { name: 'Save', exact: true }).click();
}

// ---------------------------------------------------------------------------
// History (collapsed by default — expand before asserting).
// ---------------------------------------------------------------------------

async function expandHistory(page: Page) {
	const toggle = page.getByTestId('recipe-history').locator('> button').first();
	const expanded = await toggle.getAttribute('aria-expanded');
	if (expanded !== 'true') await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

function historyEntries(page: Page) {
	return page.getByTestId('recipe-history').locator('ol#recipe-history-entries');
}

async function assertHistoryContains(page: Page, expectedText: string | RegExp) {
	await expandHistory(page);
	await expect(historyEntries(page)).toContainText(expectedText);
}

async function assertHistoryDoesNotContain(page: Page, unexpectedText: string | RegExp) {
	await expandHistory(page);
	await expect(historyEntries(page)).not.toContainText(unexpectedText);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('ingredient changes isolate correctly across the 4-node fixture', () => {
	test('add ingredient on Sibling A is recorded as "added ingredient" and isolates correctly', async ({
		page
	}) => {
		// Edit target: Sibling A.
		await openRecipe(page, RECIPE.siblingA);
		await fillAddIngredient(page, 'Onion', '1', 'whole');
		await clickPageSave(page);

		// Hard reload — verify the save actually persisted (not just client state).
		await page.reload();
		await expect(page.getByRole('heading', { name: `Recipe: ${RECIPE.siblingA}` })).toBeVisible();

		// On Sibling A (the edit target): history shows the add.
		await assertHistoryContains(page, 'added ingredient: 1 whole Onion');

		// On Grandchild (descendant, inherits chain): history shows the add.
		await openRecipe(page, RECIPE.grandchild);
		await assertHistoryContains(page, 'added ingredient: 1 whole Onion');

		// On Root (parent, no upward inheritance): history does NOT contain.
		await openRecipe(page, RECIPE.root);
		await assertHistoryDoesNotContain(page, 'Onion');

		// On Sibling B (different branch): history does NOT contain.
		await openRecipe(page, RECIPE.siblingB);
		await assertHistoryDoesNotContain(page, 'Onion');
	});

	test('edit ingredient on Sibling A is recorded as "edited ingredient: before → after"', async ({
		page
	}) => {
		// Edit Eggs (initial content on Sibling A) amount 3 → 5.
		await openRecipe(page, RECIPE.siblingA);
		await editIngredientRow(page, ingredientRow(page, 'Eggs'), 'Eggs', '5', 'whole');
		await clickPageSave(page);

		// The change must show as a single edit entry with a before/after —
		// catching the regression where edit was recorded as remove + add.
		await assertHistoryContains(page, 'edited ingredient: 3 whole Eggs → 5 whole Eggs');

		// On Grandchild: same edit visible (inherited via the chain).
		await openRecipe(page, RECIPE.grandchild);
		await assertHistoryContains(page, 'edited ingredient: 3 whole Eggs → 5 whole Eggs');

		// On Root: no Eggs history — Root's chain doesn't include Sibling A's diff.
		await openRecipe(page, RECIPE.root);
		await assertHistoryDoesNotContain(page, 'Eggs');

		// On Sibling B: no Eggs history — different branch.
		await openRecipe(page, RECIPE.siblingB);
		await assertHistoryDoesNotContain(page, 'Eggs');
	});

	test('remove ingredient from Sibling A is recorded as "removed ingredient"', async ({
		page
	}) => {
		// Remove Milk (initial content on Sibling A, untouched by other tests).
		await openRecipe(page, RECIPE.siblingA);
		await clickIngredientRowAction(page, ingredientRow(page, 'Milk'), 'Remove');
		await clickPageSave(page);

		await assertHistoryContains(page, 'removed ingredient: 1 cup Milk');

		await openRecipe(page, RECIPE.grandchild);
		await assertHistoryContains(page, 'removed ingredient: 1 cup Milk');

		await openRecipe(page, RECIPE.root);
		await assertHistoryDoesNotContain(page, 'Milk');

		await openRecipe(page, RECIPE.siblingB);
		await assertHistoryDoesNotContain(page, 'Milk');
	});
});

test.describe('direction changes isolate correctly across the 4-node fixture', () => {
	test('add direction on Sibling A is recorded as "added direction" and isolates correctly', async ({
		page
	}) => {
		const BODY = 'Serve immediately with toast';

		await openRecipe(page, RECIPE.siblingA);
		await fillAddDirection(page, BODY);
		await clickPageSave(page);

		await assertHistoryContains(page, `added direction: ${BODY}`);

		await openRecipe(page, RECIPE.grandchild);
		await assertHistoryContains(page, `added direction: ${BODY}`);

		await openRecipe(page, RECIPE.root);
		await assertHistoryDoesNotContain(page, BODY);

		await openRecipe(page, RECIPE.siblingB);
		await assertHistoryDoesNotContain(page, BODY);
	});

	test('edit direction on Sibling A is recorded as "edited direction: before → after"', async ({
		page
	}) => {
		// Edit "Crack the eggs" → "Crack the eggs gently" (initial content,
		// untouched by other tests).
		await openRecipe(page, RECIPE.siblingA);
		await editDirectionRow(page, directionRow(page, 0), 'Crack the eggs gently');
		await clickPageSave(page);

		await assertHistoryContains(
			page,
			'edited direction: Crack the eggs → Crack the eggs gently'
		);

		await openRecipe(page, RECIPE.grandchild);
		await assertHistoryContains(
			page,
			'edited direction: Crack the eggs → Crack the eggs gently'
		);

		await openRecipe(page, RECIPE.root);
		await assertHistoryDoesNotContain(page, 'Crack the eggs');

		await openRecipe(page, RECIPE.siblingB);
		await assertHistoryDoesNotContain(page, 'Crack the eggs');
	});

	test('remove direction from Sibling A is recorded as "removed direction"', async ({
		page
	}) => {
		// Remove "Whisk with milk" (initial content, index 1, untouched by other tests).
		await openRecipe(page, RECIPE.siblingA);
		await clickDirectionRowAction(page, directionRow(page, 1), 'Remove');
		await clickPageSave(page);

		await assertHistoryContains(page, 'removed direction: Whisk with milk');

		await openRecipe(page, RECIPE.grandchild);
		await assertHistoryContains(page, 'removed direction: Whisk with milk');

		await openRecipe(page, RECIPE.root);
		await assertHistoryDoesNotContain(page, 'Whisk with milk');

		await openRecipe(page, RECIPE.siblingB);
		await assertHistoryDoesNotContain(page, 'Whisk with milk');
	});
});
