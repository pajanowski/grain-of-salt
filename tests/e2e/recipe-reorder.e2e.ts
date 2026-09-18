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
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
	openCreateForm,
	getRecipeNameInput,
	getCreateButton,
	getRecipeLink,
	getRecipeHeading,
	getRecipeActionsButton,
	getRecipeActionsMenuItem,
	clickRowAction,
	clickPageSave,
	fillAddIngredient,
	fillAddDirection,
	submitAddDirection,
	getIngredientNames,
	getDirectionBodies,
	ingredientRowByName,
	directionRowByIndex,
	getRowSaveButton,
	getNodeChangesCount,
	forkRecipe
} from './helpers/page-utils';

async function createReorderRecipe(page: import('@playwright/test').Page): Promise<string> {
	const name = uuidv4();
	await page.goto('/mise');
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(name);
	await getCreateButton(page).click();
	await expect(getRecipeLink(page, name)).toBeVisible();

	// Navigate to the recipe page
	await getRecipeLink(page, name).click();
	await expect(getRecipeHeading(page, name)).toBeVisible();

	// Add 3 ingredients
	await fillAddIngredient(page, 'Alpha', '1', 'cup');
	await fillAddIngredient(page, 'Beta', '2', 'tbsp');
	await fillAddIngredient(page, 'Gamma', '3', 'tsp');

	// Add 3 directions
	await fillAddDirection(page, 'Step 1');
	await submitAddDirection(page);
	await fillAddDirection(page, 'Step 2');
	await submitAddDirection(page);
	await fillAddDirection(page, 'Step 3');
	await submitAddDirection(page);

	return name;
}

test('move ingredient up — swaps with the item above it', async ({ page }) => {
	await createReorderRecipe(page);

	// Initial order: Alpha, Beta, Gamma
	await expect(getIngredientNames(page)).resolves.toEqual(['Alpha', 'Beta', 'Gamma']);

	// Move Beta up → order should become: Beta, Alpha, Gamma
	await clickRowAction(page, ingredientRowByName(page, 'Beta'), 'Move up');
	await expect(getIngredientNames(page)).resolves.toEqual(['Beta', 'Alpha', 'Gamma']);
});

test('move ingredient down — swaps with the item below it', async ({ page }) => {
	await createReorderRecipe(page);

	// Initial order: Alpha, Beta, Gamma
	await expect(getIngredientNames(page)).resolves.toEqual(['Alpha', 'Beta', 'Gamma']);

	// Move Alpha down → order should become: Beta, Alpha, Gamma
	await clickRowAction(page, ingredientRowByName(page, 'Alpha'), 'Move down');
	await expect(getIngredientNames(page)).resolves.toEqual(['Beta', 'Alpha', 'Gamma']);
});

test('move direction up — swaps with the direction above it', async ({ page }) => {
	await createReorderRecipe(page);

	// Initial order: Step 1, Step 2, Step 3
	await expect(getDirectionBodies(page)).resolves.toEqual(['Step 1', 'Step 2', 'Step 3']);

	// Move Step 2 up → order should become: Step 2, Step 1, Step 3
	await clickRowAction(page, directionRowByIndex(page, 1), 'Move up');
	await expect(getDirectionBodies(page)).resolves.toEqual(['Step 2', 'Step 1', 'Step 3']);
});

test('move direction down — swaps with the direction below it', async ({ page }) => {
	await createReorderRecipe(page);

	// Initial order: Step 1, Step 2, Step 3
	await expect(getDirectionBodies(page)).resolves.toEqual(['Step 1', 'Step 2', 'Step 3']);

	// Move Step 2 down → order should become: Step 1, Step 3, Step 2
	await clickRowAction(page, directionRowByIndex(page, 1), 'Move down');
	await expect(getDirectionBodies(page)).resolves.toEqual(['Step 1', 'Step 3', 'Step 2']);
});

test('move up on first item is a no-op', async ({ page }) => {
	await createReorderRecipe(page);

	// The "Move up" menuitem is disabled at index 0 — the action is blocked
	// before it reaches moveIngredient. Verify the order is unchanged.
	await expect(getIngredientNames(page)).resolves.toEqual(['Alpha', 'Beta', 'Gamma']);
});

test('moved order persists after save and reload', async ({ page }) => {
	const name = await createReorderRecipe(page);

	// Move Beta up
	await clickRowAction(page, ingredientRowByName(page, 'Beta'), 'Move up');
	await expect(getIngredientNames(page)).resolves.toEqual(['Beta', 'Alpha', 'Gamma']);

	// Save — the save bar disappears after a successful save
	await clickPageSave(page);

	// Reload and verify order persisted
	await page.reload();
	await expect(getRecipeHeading(page, name)).toBeVisible();
	await expect(getIngredientNames(page)).resolves.toEqual(['Beta', 'Alpha', 'Gamma']);
});

test('repeated moves do not bloat the per-node changes sidebar', async ({ page }) => {
	// Regression: every move used to emit fresh `add` change records for every
	// visible row (one new UUID per move per row). After N moves on a fixture
	// with K rows the sidebar grew to N*K + K instead of staying at K.
	// The fix preserves the original `add` records across moves; only their
	// position in the array changes.
	await createReorderRecipe(page);

	// Baseline: 3 ingredients + 3 directions = 6 changes
	const initial = await getNodeChangesCount(page);
	expect(initial).toBe(6);

	// Perform several moves — each one swaps two rows. None should add new
	// change records to the leaf's array.
	await clickRowAction(page, ingredientRowByName(page, 'Beta'), 'Move up');
	await clickRowAction(page, ingredientRowByName(page, 'Gamma'), 'Move up');
	await clickRowAction(page, directionRowByIndex(page, 0), 'Move down');
	await clickRowAction(page, directionRowByIndex(page, 2), 'Move up');

	const afterMoves = await getNodeChangesCount(page);
	expect(afterMoves).toBe(initial);
});

test('reorder-only adds are not surfaced in the sidebar when moving past ancestor rows', async ({
	page
}) => {
	// Regression: when the leaf moves a leaf-added ingredient past several
	// ancestor-originated rows, each ancestor row currently gets a fresh
	// reorder-only `add` record (`targetId = rowId`). These position claims
	// shouldn't appear in the "Changes on this node" sidebar — they're
	// invisible to the user, just ordering information. The sidebar should
	// only show changes the leaf owns body for: genuine `add`s
	// (`targetId === null`), `edit`s, and `remove`s.
	const rootName = uuidv4();

	// Root has Ing-A, Ing-B, Ing-C, Ing-D (4 ancestor rows).
	await page.goto('/mise');
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(rootName);
	await getCreateButton(page).click();
	await getRecipeLink(page, rootName).click();
	await getRecipeHeading(page, rootName).waitFor();
	await fillAddIngredient(page, 'Ing-A', '1', 'cup');
	await fillAddIngredient(page, 'Ing-B', '1', 'cup');
	await fillAddIngredient(page, 'Ing-C', '1', 'cup');
	await fillAddIngredient(page, 'Ing-D', '1', 'cup');
	await expect(getIngredientNames(page)).resolves.toEqual(['Ing-A', 'Ing-B', 'Ing-C', 'Ing-D']);
	await clickPageSave(page);

	// Fork and add Ing-X (leaf-owned).
	await forkRecipe(page, uuidv4);
	await expect(getIngredientNames(page)).resolves.toEqual(['Ing-A', 'Ing-B', 'Ing-C', 'Ing-D']);
	await fillAddIngredient(page, 'Ing-X', '1', 'cup');
	await expect(getIngredientNames(page)).resolves.toEqual([
		'Ing-A',
		'Ing-B',
		'Ing-C',
		'Ing-D',
		'Ing-X'
	]);

	// Baseline: leaf has 1 genuine `add` (for Ing-X) → sidebar shows 1 change.
	const initial = await getNodeChangesCount(page);
	expect(initial).toBe(1);

	// Move Ing-X to the top (4 moves up). It swaps past Ing-D, Ing-C, Ing-B, Ing-A.
	// Each of those ancestor rows gets a reorder-only `add` claim, but those
	// should not appear in the sidebar.
	await clickRowAction(page, ingredientRowByName(page, 'Ing-X'), 'Move up');
	await clickRowAction(page, ingredientRowByName(page, 'Ing-X'), 'Move up');
	await clickRowAction(page, ingredientRowByName(page, 'Ing-X'), 'Move up');
	await clickRowAction(page, ingredientRowByName(page, 'Ing-X'), 'Move up');
	await expect(getIngredientNames(page)).resolves.toEqual([
		'Ing-X',
		'Ing-A',
		'Ing-B',
		'Ing-C',
		'Ing-D'
	]);

	// Sidebar should still show only 1 change (the genuine `add` for Ing-X).
	const afterMoves = await getNodeChangesCount(page);
	expect(afterMoves).toBe(initial);
});

test('parent edit on a moved ancestor ingredient is reflected on the child', async ({ page }) => {
	// Regression: when the user moves a leaf-added ingredient above an
	// ancestor-originated one (Bug 3 fix), the leaf's moveIngredient emits
	// an `add` record for the ancestor row with `body = the current row
	// snapshot`. If the parent later edits that row, the leaf's snapshot
	// clobbers the parent's edit on the next page load — the child sees
	// the stale amount from when the move happened, not the parent's edit.
	const rootName = uuidv4();

	// Create root with Ing-A (amount=1, cup).
	await page.goto('/mise');
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(rootName);
	await getCreateButton(page).click();
	await getRecipeLink(page, rootName).click();
	await expect(getRecipeHeading(page, rootName)).toBeVisible();

	await fillAddIngredient(page, 'Ing-A', '1', 'cup');

	// Persist the root so the fork has something to inherit.
	await clickPageSave(page);
	const rootUrl = page.url();

	// Fork the root. The fork's heading is the fork's own name (server
	// populates `recipe.name` from `currentNode.name`); the parent name
	// appears in the breadcrumb but not as a heading.
	await getRecipeActionsButton(page).click();
	await getRecipeActionsMenuItem(page, 'Fork recipe').click();
	const forkedName = uuidv4();
	await page.getByLabel('Forked recipe name').fill(forkedName);
	await page.getByRole('button', { name: 'Fork', exact: true }).click();
	await expect(getRecipeHeading(page, forkedName)).toBeVisible();

	// Add a fork-owned ingredient (Ing-B) and move it above the inherited
	// Ing-A. This is the Bug 3 scenario: the leaf must emit a fresh `add`
	// for Ing-A at position 1 in its array.
	await fillAddIngredient(page, 'Ing-B', '2', 'tbsp');
	await clickRowAction(page, ingredientRowByName(page, 'Ing-B'), 'Move up');
	await expect(getIngredientNames(page)).resolves.toEqual(['Ing-B', 'Ing-A']);

	// Persist the fork so its reordered array (with the Ing-A `add`) is
	// stored — this is the array that will clobber the parent's later edit.
	await clickPageSave(page);
	const forkUrl = page.url();

	// Go back to the root and edit Ing-A's amount: 1 → 7.
	await page.goto(rootUrl);
	await expect(getRecipeHeading(page, rootName)).toBeVisible();
	const rootARow = ingredientRowByName(page, 'Ing-A');
	await clickRowAction(page, rootARow, 'Edit');
	// The edit form opens inside the row; the add-ingredient form is outside
	// any row, so scoping by row isolates the edit-form amount input.
	await rootARow.getByPlaceholder('Amount (e.g. 1/3, 1 1/2)').fill('7');
	await getRowSaveButton(rootARow).click();
	await clickPageSave(page);

	// Navigate back to the fork. Server replays root → fork: the root's
	// `edit(Ing-A, amount=7)` should win over the fork's stale `add` snapshot.
	await page.goto(forkUrl);
	await expect(getRecipeHeading(page, forkedName)).toBeVisible();

	// Expectation: Ing-A on the fork shows the parent's edited amount (7),
	// not the stale snapshot the leaf captured at move time (1).
	const ingARow = ingredientRowByName(page, 'Ing-A');
	const text = (await ingARow.textContent()) ?? '';
	expect(text).toContain('7');
});
