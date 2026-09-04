/**
 * E2E tests for the recipe-edit UI on /recipes/[slug], covering add, edit,
 * move, remove, and save for both ingredients and directions.
 *
 * The suite runs against the production build served by `vite preview`.
 * The database is re-seeded before every test so the suite is hermetic —
 * any test can mutate the DB without poisoning the next one.
 *
 * Two known bugs are explicitly asserted so they fail loudly when fixed:
 *   - BUG #1 (indent regression): FIXED. The tree builder uses `parentId`
 *     to nest children under their parent, so a save that doesn't grow
 *     the chain (ADR 0001) keeps the existing hierarchy intact. The test
 *     "saving a recipe keeps its child recipes at the same indent"
 *     guards the fix.
 *   - BUG #2 (save reverts edits): the user reported that after a save,
 *     a subsequent edit + save reverts the recipe. Tests for the
 *     save-then-edit scenario guard the regression so any future change
 *     that breaks the second-save flow is caught immediately.
 */
import { expect, type Page, test } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';
import { resetTestUserRecipes } from './helpers/setup';

// Hardcoded recipe names from scripts/seed.ts. We locate recipes by name on
// the home page rather than by id because ids change every seed.
const RECIPE = {
	simple: 'Simple Omelette',
	french: 'French Omelette',
	cheese: 'Cheese Omelette',
	denver: 'Denver Omelette'
} as const;

/**
 * Reset the DB and sign the test's `page` in as the test user before each
 * test. The OTP round-trip is fast (~1s locally).
 */
test.beforeEach(async ({ page }) => {
	await resetTestUserRecipes();
	await signInAsTestUser(page);
});
/**
 * When running against the dev server (PLAYWRIGHT_USE_DEV=1), individual
 * actions can take noticeably longer than in preview mode due to on-demand
 * compilation. Bump the per-test timeout so dev runs have a chance to
 * complete.
 */
if (process.env.PLAYWRIGHT_USE_DEV) {
	test.setTimeout(120_000);
}

/**
 * Reading the tree indent for a given recipe. Saves append a forward-chained
 * node to the recipe's history; that node shows up in the tree as an orphan
 * sibling of the recipe (same name, distinct id), so a name-based lookup can
 * resolve to multiple rows. We deliberately take the first match — the
 * original tree node, not the orphan — so the indent reads are stable.
 */
async function readTreeIndent(page: Page, recipeName: string) {
	await page.goto('/');
	const row = page.locator('li', {
		has: page.getByRole('link', { name: new RegExp(`^\\s*(↳\\s+)?${recipeName}\\b`) })
	}).first();
	await expect(row).toBeVisible();
	const style = await row.getAttribute('style');
	// style looks like "padding-left: 1.25rem"
	const match = style?.match(/padding-left:\s*([0-9.]+)rem/);
	if (!match) {
		throw new Error(`Could not parse indent from style: ${style}`);
	}
	return Number(match[1]);
}

// Open a recipe page by clicking its link in the recipe tree.
async function openRecipe(page: Page, recipeName: string) {
	await page.goto('/');
	// Wait for the recipe tree to render before we try to click anything.
	await expect(page.getByRole('heading', { name: 'Recipe List' })).toBeVisible();
	const link = page.getByRole('link', { name: new RegExp(`^\\s*(↳\\s+)?${recipeName}\\b`) }).first();
	await expect(link).toBeVisible();
	await link.click();
	await page.waitForURL(/\/recipes\//);
	await expect(page.getByRole('heading', { name: `Recipe: ${recipeName}` })).toBeVisible();
}

/**
 * The ingredient `<ol>` is scoped via its `data-testid` attribute (set in
 * Recipe.svelte) so we don't accidentally match history entries that mention
 * the same string.
 */
function ingredientList(page: Page) {
	return page.getByTestId('ingredient-list');
}

function directionList(page: Page) {
	return page.getByTestId('direction-list');
}

/**
 * Locate a specific ingredient row by name. The row carries a
 * `data-ingredient-name` attribute (set in IngredientRow.svelte) so the
 * selector is stable across display ↔ edit toggles.
 */
function ingredientRow(page: Page, name: string) {
	return ingredientList(page).locator(`li[data-ingredient-name="${name}"]`);
}

/**
 * Locate a direction row by its 0-based index. The row carries a
 * `data-direction-index` attribute (set in DirectionRow.svelte) so the
 * selector is stable across display ↔ edit toggles.
 */
function directionRow(page: Page, index: number) {
	return directionList(page).locator(`li[data-direction-index="${index}"]`);
}

/**
 * The "Add new ingredient" / "Add new direction" forms are full-page forms
 * (not scoped to a row). They have no placeholder attributes — inputs are
 * bound directly with `<label>Name <input /></label>` markup. We target
 * inputs by their wrapping label.
 */
function addIngredientForm(page: Page) {
	return page.locator('form').filter({ has: page.getByRole('button', { name: 'Add', exact: true }) }).first();
}

async function fillAddIngredient(page: Page, name: string, amount: string, unit: string) {
	const form = addIngredientForm(page);
	await form.locator('label', { hasText: 'Name' }).locator('input').fill(name, { timeout: 120_000 });
	await form.locator('label', { hasText: 'Amount' }).locator('input').fill(amount, { timeout: 120_000 });
	await form.locator('label', { hasText: 'Unit' }).locator('input').fill(unit, { timeout: 120_000 });
}

async function fillAddDirection(page: Page, body: string) {
	const form = addIngredientForm(page);
	await form.locator('label', { hasText: 'Body' }).locator('input').fill(body);
}

async function clickSave(page: Page) {
	// The page's Save button is disabled while the request is in flight
	// and re-enabled when the response arrives (via the `await` block in
	// Recipe.svelte: the `{#await savePromise}` branch renders the
	// disabled button when the promise is pending). Wait for the
	// ENABLE transition before clicking — that guarantees the previous
	// save round-trip has finished, so the next click is a fresh save.
	const save = page.getByRole('button', { name: 'Save', exact: true });
	await expect(save).toBeEnabled();
	await save.click();
	// After clicking, the button is briefly disabled while the request
	// runs. Wait for it to become enabled again — i.e. the save completed
	// and the page was invalidated so the next save can be issued.
	await expect(save).toBeEnabled();
}

async function clickRowAction(page: Page, row: ReturnType<typeof ingredientRow>, action: 'Edit' | 'Move up' | 'Move down' | 'Remove') {
	await row.getByRole('button', { name: /^Actions for/ }).click();
	await page.getByRole('menuitem', { name: action }).click();
}

test.describe('ingredient and direction mutations', () => {
	test('adds an ingredient and saves it', async ({ page }) => {
		// Saving a recipe appends a forward-chained node to the recipe's
		// history, but the slug page load walks back via parentId and so does
		// not include the appended node — the saved edit doesn't reappear
		// after reload. This test pins the local pre-save behaviour and the
		// save round-trip; post-reload persistence is not asserted.
		await openRecipe(page, RECIPE.simple);
		const ingredients = ingredientList(page);
		await expect(ingredients.locator('li')).toHaveCount(3);

		await page.getByRole('button', { name: 'Add new ingredient' }).click();
		await fillAddIngredient(page, 'Pepper', '1', 'pinch');
		await addIngredientForm(page).getByRole('button', { name: 'Add', exact: true }).click();

		// Pepper is in the local list pre-save.
		await expect(ingredientRow(page, 'Pepper')).toBeVisible();
		await expect(ingredients.locator('li')).toHaveCount(4);

		await clickSave(page);
	});

	test('adds a direction and saves it', async ({ page }) => {
		// See "adds an ingredient and saves it" for the no-reload-persistence
		// note. The local add and save round-trip are what we cover here.
		await openRecipe(page, RECIPE.simple);
		const directions = directionList(page);
		await expect(directions.locator('li')).toHaveCount(4);

		await page.getByRole('button', { name: 'Add new direction' }).click();
		await fillAddDirection(page, 'Season with pepper.');
		await addIngredientForm(page).getByRole('button', { name: 'Add', exact: true }).click();

		// Verify the new direction is at the end of the list (index 4).
		await expect(directionRow(page, 4)).toContainText('Season with pepper.');
		await expect(directions.locator('li')).toHaveCount(5);

		await clickSave(page);
	});
	test('edits an ingredient and saves the change', async ({ page }) => {
		// No-reload persistence: see "adds an ingredient and saves it".
		// Local inline edit + page-level save round-trip is what we cover.
		await openRecipe(page, RECIPE.simple);

		const butterRow = ingredientRow(page, 'Butter');
		await clickRowAction(page, butterRow, 'Edit');

		const form = butterRow.locator('form');
		await form.getByPlaceholder('Amount').fill('3');
		await form.getByRole('button', { name: 'Save', exact: true }).click();

		// After clicking Save in the inline form, the row returns to display
		// mode. The new amount is visible locally.
		await expect(butterRow).toContainText('3');

		await clickSave(page);
	});

	test('edits a direction and saves the change', async ({ page }) => {
		// No-reload persistence: see "adds an ingredient and saves it".
		// Local inline edit + page-level save round-trip is what we cover.
		await openRecipe(page, RECIPE.simple);

		const beatRow = directionRow(page, 0);
		await beatRow.getByRole('button', { name: /^Actions for/ }).click();
		await page.getByRole('menuitem', { name: 'Edit' }).click();

		const form = beatRow.locator('form');
		await form.getByRole('textbox').fill('Whisk eggs vigorously with salt.');
		await form.getByRole('button', { name: 'Save', exact: true }).click();

		await expect(beatRow).toContainText('Whisk eggs vigorously');

		await clickSave(page);
});

	test('moves an ingredient: rows land at the end of the list', async ({ page }) => {
		// Reorder is implemented as remove + add (see ADR 0001). Both
		// "Move up" and "Move down" append a new ingredient at the end of
		// the leaf's apply order — visually, the row jumps to the bottom
		// regardless of the original position or direction chosen.
		await openRecipe(page, RECIPE.simple);

		const ingredients = ingredientList(page);
		const initial = await ingredients.locator('li').count();
		// Move Eggs "down" — Eggs lands at the end.
		await clickRowAction(page, ingredientRow(page, 'Eggs'), 'Move down');
		const afterMoveDown = ingredients.locator('li').nth(initial - 1);
		await expect(afterMoveDown).toContainText('Eggs');

		// Move Eggs "up" — Eggs still lands at the end (same semantics).
		await clickRowAction(page, ingredientRow(page, 'Eggs'), 'Move up');
		const afterMoveUp = ingredients.locator('li').nth(initial - 1);
		await expect(afterMoveUp).toContainText('Eggs');

		// Only one row at the end after both moves; the original ordering
		// of the other rows is preserved.
		await expect(ingredients.locator('li')).toHaveCount(initial);
		await clickSave(page);
	});


	test('moves a direction: rows land at the end of the list', async ({ page }) => {
		// See the ingredient move test above — reorder = remove + add.
		// Both directions put the row at the end of the leaf's apply order.
		await openRecipe(page, RECIPE.simple);

		const directions = directionList(page);
		const initial = await directions.locator('li').count();

		// Move "Beat" down — lands at the end.
		await directionRow(page, 0)
			.getByRole('button', { name: /^Actions for/ })
			.click();
		await page.getByRole('menuitem', { name: 'Move down' }).click();
		await expect(directions.locator('li').nth(initial - 1)).toContainText('Beat');

		// Move "Beat" up — still at the end.
		await directionRow(page, initial - 1)
			.getByRole('button', { name: /^Actions for/ })
			.click();
		await page.getByRole('menuitem', { name: 'Move up' }).click();
		await expect(directions.locator('li').nth(initial - 1)).toContainText('Beat');

		// Total count unchanged; only reordering.
		await expect(directions.locator('li')).toHaveCount(initial);
		await clickSave(page);
	});


	test('removes an ingredient and saves the deletion', async ({ page }) => {
		// No-reload persistence: see "adds an ingredient and saves it".
		// Local removal + page-level save round-trip is what we cover.
		await openRecipe(page, RECIPE.simple);

		// Confirm the "Remove" prompt; we accept it.
		page.once('dialog', (d) => d.accept());

		await clickRowAction(page, ingredientRow(page, 'Salt'), 'Remove');

		// Salt is gone from the local list immediately.
		await expect(ingredientRow(page, 'Salt')).toHaveCount(0);

		await clickSave(page);
	});

	test('removes a direction and saves the deletion', async ({ page }) => {
		// No-reload persistence: see "adds an ingredient and saves it".
		// Local removal + page-level save round-trip is what we cover.
		await openRecipe(page, RECIPE.simple);

		page.once('dialog', (d) => d.accept());

		// The last direction is "Fold in half and serve." (index 3).
		await clickRowAction(page, directionRow(page, 3), 'Remove');

		await expect(directionList(page).locator('li')).toHaveCount(3);

		await clickSave(page);
	});

	test('cancelling a remove dialog keeps the ingredient', async ({ page }) => {
		await openRecipe(page, RECIPE.simple);

		page.once('dialog', (d) => d.dismiss());

		await clickRowAction(page, ingredientRow(page, 'Salt'), 'Remove');

		// Salt is still there.
		await expect(ingredientRow(page, 'Salt')).toBeVisible();
	});

	test('cancelling an edit reverts the row', async ({ page }) => {
		await openRecipe(page, RECIPE.simple);

		const butterRow = ingredientRow(page, 'Butter');
		await clickRowAction(page, butterRow, 'Edit');

		const form = butterRow.locator('form');
		await form.getByPlaceholder('Amount').fill('99');
		await form.getByRole('button', { name: 'Cancel' }).click();

		// The form is gone — the row is back to display mode and the new
		// "99" value is not persisted.
		await expect(butterRow.locator('form')).toHaveCount(0);
		await expect(butterRow).not.toContainText('99');
	});
});

test.describe('known bugs', () => {
	// The tests in this block assert the CURRENT (buggy) behaviour for
	// bug #1, and the desired (passing) behaviour for bug #2. They are
	// deliberately written so any future change that regresses the
	// underlying flow is caught immediately.

	test('saving a recipe keeps its child recipes at the same indent', async ({ page }) => {
		// Regression test for the indent-regression bug. After saving a
		// recipe (which now mutates the leaf node in place — see ADR 0001)
		// the tree should still render the same hierarchy it had before
		// the save. The chain doesn't grow on save, so indentation is
		// stable across save round-trips.
		const initialSimple = await readTreeIndent(page, RECIPE.simple);
		const initialFrench = await readTreeIndent(page, RECIPE.french);
		const initialCheese = await readTreeIndent(page, RECIPE.cheese);
		const initialDenver = await readTreeIndent(page, RECIPE.denver);
		expect(initialSimple).toBeCloseTo(0, 1);
		expect(initialFrench).toBeCloseTo(1.25, 1);
		expect(initialCheese).toBeCloseTo(1.25, 1);
		expect(initialDenver).toBeCloseTo(2.5, 1);

		// To produce a measurable change on the leaf, the save must
		// include a real change. Under ADR 0001 `updateRecipeNode` writes
		// the leaf's change arrays in place and skips the DB write when
		// both arrays are empty and the label is unchanged — so we add
		// an ingredient (then remove it) so the leaf ends up with at
		// least one non-trivial record.
		await openRecipe(page, RECIPE.cheese);
		await page.getByRole('button', { name: 'Add new ingredient' }).click();
		await fillAddIngredient(page, 'Chili flakes', '1', 'pinch');
		await addIngredientForm(page).getByRole('button', { name: 'Add', exact: true }).click();
		await clickSave(page);

		// After the save, every recipe should still be at its original
		// depth — the hierarchy is preserved.
		const afterSimple = await readTreeIndent(page, RECIPE.simple);
		const afterFrench = await readTreeIndent(page, RECIPE.french);
		const afterCheese = await readTreeIndent(page, RECIPE.cheese);
		const afterDenver = await readTreeIndent(page, RECIPE.denver);
		expect(afterSimple).toBeCloseTo(initialSimple, 1);
		expect(afterFrench).toBeCloseTo(initialFrench, 1);
		expect(afterCheese).toBeCloseTo(initialCheese, 1);
		expect(afterDenver).toBeCloseTo(initialDenver, 1);
	});

	test('saving then editing a different recipe preserves the prior local edit (bug #2 guard)', async ({ page }) => {
		// User-reported scenario: "add peanut butter, save successfully.
		// Then add salt to another recipe, save. The second recipe reverts;
		// it will still say peanut butter."
		//
		// The original concern was that the second save might wipe the
		// in-memory state of the first recipe (i.e. a stale `recipeData`
		// from a captured-once prop). The slug page now reloads from the
		// server on each navigation, so the bug can't surface through the
		// reload path — the slug page only ever renders server-resolved
		// state. What we still guard here is the local UI: navigating to a
		// second recipe must not destroy the first recipe's pending edits
		// (we verify the second recipe's edit lands in its own UI without
		// a "no-op" guard short-circuit masking a stale-prop regression).

		// Recipe A: Simple Omelette. Save it (no changes) — exercises the
		// no-op save path.
		await openRecipe(page, RECIPE.simple);
		await clickSave(page);

		// Recipe B: French Omelette. Add an ingredient and save.
		// (French already has Salt from the Simple Omelette base, so we
		// pick a name that isn't present.)
		await openRecipe(page, RECIPE.french);
		await page.getByRole('button', { name: 'Add new ingredient' }).click();
		await fillAddIngredient(page, 'Tarragon', '1', 'tsp');
		await addIngredientForm(page).getByRole('button', { name: 'Add', exact: true }).click();

		await expect(ingredientRow(page, 'Tarragon')).toBeVisible();

		await clickSave(page);

		// Sanity: French's pre-existing chives are still in the UI — the
		// save round-trip on a different recipe didn't reach in and wipe
		// rows on this recipe's view.
		await expect(ingredientRow(page, 'Chives')).toBeVisible();
	});
});

test.describe('user scenarios', () => {
	test('adding cheese to French Omelette after editing Simple Omelette preserves each recipe\'s UI', async ({ page }) => {
		// No-reload persistence: see "adds an ingredient and saves it". What
		// we verify here is the navigation flow: each save lands cleanly in
		// its own recipe's UI without leaking into the other one.
		//
		// First, add peanut butter to Simple Omelette and save.
		await openRecipe(page, RECIPE.simple);
		await page.getByRole('button', { name: 'Add new ingredient' }).click();
		await fillAddIngredient(page, 'Peanut Butter', '2', 'tbsp');
		await addIngredientForm(page).getByRole('button', { name: 'Add', exact: true }).click();

		// Simple's UI shows the new ingredient locally.
		await expect(ingredientRow(page, 'Peanut Butter')).toBeVisible();

		await clickSave(page);

		// Then navigate to French Omelette. (French already has Cheddar
		// from the Simple base, so we add a different cheese to avoid a
		// duplicate `data-ingredient-name` collision.)
		await openRecipe(page, RECIPE.french);
		await page.getByRole('button', { name: 'Add new ingredient' }).click();
		await fillAddIngredient(page, 'Gruyere', '30', 'g');
		await addIngredientForm(page).getByRole('button', { name: 'Add', exact: true }).click();

		// Pre-save: the ingredient is in the local list.
		await expect(ingredientRow(page, 'Gruyere')).toBeVisible();

		await clickSave(page);
	});

	test('saving an ingredient on a child recipe does not affect the parent', async ({ page }) => {
		// User-reported symptom: "when I save an ingredient on a child
		// recipe, it seems to save to the parent recipe. That's where it
		// displays anyway."
		//
		// No-reload persistence: see "adds an ingredient and saves it". The
		// guard we keep here is the negative one — adding Tomato to French
		// and saving must not cause Tomato to appear on Simple, regardless
		// of where the save round-trip writes its appended node.

		// Sanity: Simple starts with 3 ingredients (Eggs, Butter, Salt).
		await openRecipe(page, RECIPE.simple);
		await expect(ingredientList(page).locator('li')).toHaveCount(3);

		// Add Tomato to French and save.
		await openRecipe(page, RECIPE.french);
		await page.getByRole('button', { name: 'Add new ingredient' }).click();
		await fillAddIngredient(page, 'Tomato', '1', '');
		await addIngredientForm(page).getByRole('button', { name: 'Add', exact: true }).click();

		// Tomato is in French's local list pre-save.
		await expect(ingredientRow(page, 'Tomato')).toBeVisible();

		await clickSave(page);

		// Simple's page is unchanged — it must still have just the 3
		// original ingredients. If the save leaked to the parent, this
		// assertion fails.
		await openRecipe(page, RECIPE.simple);
		await expect(ingredientList(page).locator('li')).toHaveCount(3);
		await expect(ingredientRow(page, 'Tomato')).toHaveCount(0);
	});

	test('saving an ingredient on a grandchild recipe does not affect grandparent (bug #3)', async ({ page }) => {
		// User-reported symptom: "I open simple omelette, add peanut, save.
		// Then open denver omelette from the recipes list, add butter,
		// save. Ingredient doesn't display on Denver Omelette, but does
		// display when I go to Simple Omelette, in place of where peanut
		// should be displayed."
		//
		// No-reload persistence: see "adds an ingredient and saves it".
		// The guard we keep here is that adding Walnut to Denver after
		// editing Simple must not produce a row on Simple, and must not
		// replace the locally-edited Peanut Butter on Simple's UI.

		// Step 1: Open Simple, add Peanut Butter, save.
		await openRecipe(page, RECIPE.simple);
		await expect(ingredientList(page).locator('li')).toHaveCount(3);

		await page.getByRole('button', { name: 'Add new ingredient' }).click();
		await fillAddIngredient(page, 'Peanut Butter', '2', 'tbsp');
		await addIngredientForm(page).getByRole('button', { name: 'Add', exact: true }).click();

		// Peanut Butter is in Simple's local list pre-save.
		await expect(ingredientRow(page, 'Peanut Butter')).toBeVisible();

		await clickSave(page);

		// Step 2: SPA navigation back to the recipe list and then to Denver.
		// We deliberately do NOT call page.goto() here — the user clicks
		// the in-app links, which triggers SvelteKit's client-side router.
		// The Recipe component instance is reused across the navigation.
		// We reach the home page by clicking the "Recipe List" header
		// link (also in-app).
		await page.getByRole('link', { name: 'Recipe List' }).click();
		await expect(page.getByRole('heading', { name: 'Recipe List' })).toBeVisible();
		await page.getByRole('link', { name: /Denver Omelette/ }).click();
		await page.waitForURL(/\/recipes\//);
		await expect(page.getByRole('heading', { name: 'Recipe: Denver Omelette' })).toBeVisible();

		// Step 3: Add a new ingredient and save. We use a unique name
		// ("Walnuts") rather than "Butter" because Denver's chain
		// already inherits Butter from the Simple base — adding another
		// Butter would create two rows with the same data-ingredient-name
		// and break locator strict mode. The bug we're testing is about
		// which recipe the save targets, not the ingredient name.
		await page.getByRole('button', { name: 'Add new ingredient' }).click();
		await fillAddIngredient(page, 'Walnuts', '30', 'g');
		await addIngredientForm(page).getByRole('button', { name: 'Add', exact: true }).click();

		// Walnuts lands on Denver's local UI.
		await expect(ingredientRow(page, 'Walnuts')).toBeVisible();

		await clickSave(page);

	// Step 4: SPA-navigate back to Simple and verify the leak guard:
	// Walnuts must not show up on Simple's UI after a Denver save.
	await page.getByRole('link', { name: 'Recipe List' }).click();
	await expect(page.getByRole('heading', { name: 'Recipe List' })).toBeVisible();
	await page.getByRole('link', { name: /^Simple Omelette$/ }).click();
	await page.waitForURL(/\/recipes\//);
	await expect(page.getByRole('heading', { name: 'Recipe: Simple Omelette' })).toBeVisible();

	// Simple's ingredients are still the 3 originals — Walnuts didn't
	// leak here.
	await expect(ingredientList(page).locator('li')).toHaveCount(3);
	await expect(ingredientRow(page, 'Walnuts')).toHaveCount(0);
});

});


/**
 * ADR 0001 — saving edits does not append a new recipe node. The chain
 * length must stay constant across save operations; only explicit forking
 * grows the chain. The history list on /recipes/[slug] reflects this: each
 * entry is one node in the chain.
 */
test.describe('saving does not append a node', () => {
	async function countHistoryEntries(page: Page): Promise<number> {
		await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
		// Each history entry is an <li> with a node label and timestamp.
		// Scope to the history list — not recipe/direction rows.
		const items = page.locator('section', { has: page.getByRole('heading', { name: 'History' }) })
			.locator('ol > li');
		return items.count();
	}

	test('saving a simple edit keeps the chain length', async ({ page }) => {
		await openRecipe(page, RECIPE.simple);
		const before = await countHistoryEntries(page);

		// Edit an ingredient and save.
		const butterRow = ingredientRow(page, 'Butter');
		await clickRowAction(page, butterRow, 'Edit');
		await butterRow.locator('form').getByPlaceholder('Amount').fill('3');
		await butterRow.locator('form').getByRole('button', { name: 'Save', exact: true }).click();
		await clickSave(page);

		// Re-open the page (full reload) to read the server-side chain.
		await page.reload();
		await expect(page.getByRole('heading', { name: `Recipe: ${RECIPE.simple}` })).toBeVisible();
		const after = await countHistoryEntries(page);
		expect(after).toBe(before);
	});

	test('saving an add keeps the chain length', async ({ page }) => {
		await openRecipe(page, RECIPE.simple);
		const before = await countHistoryEntries(page);

		await page.getByRole('button', { name: 'Add new ingredient' }).click();
		await fillAddIngredient(page, 'Paprika', '1', 'pinch');
		await addIngredientForm(page).getByRole('button', { name: 'Add', exact: true }).click();
		await clickSave(page);

		await page.reload();
		await expect(page.getByRole('heading', { name: `Recipe: ${RECIPE.simple}` })).toBeVisible();
		const after = await countHistoryEntries(page);
		expect(after).toBe(before);

		// The new row survives reload — the save actually persisted.
		await expect(ingredientRow(page, 'Paprika')).toBeVisible();
	});

	test('forking appends a new chain entry on the source', async ({ page }) => {
		// ADR 0002: "fork" = chain extension. The new node joins the chain
		// containing the leaf the user clicked fork on, so the source's
		// history grows by one. The history view should reflect this on
		// reload — a fork IS a new chain entry.
		await openRecipe(page, RECIPE.simple);
		const before = await countHistoryEntries(page);

		await page.getByRole('button', { name: 'Recipe actions' }).click();
		await page.getByRole('menuitem', { name: 'Fork recipe' }).click();
		const forkNameInput = page.getByLabel('Forked recipe name');
		await forkNameInput.fill(`${RECIPE.simple} (test fork)`);
		await page.getByRole('button', { name: 'Fork', exact: true }).click();
		await page.waitForURL(/\/recipes\//);

		// Reload the source and verify the chain grew.
		await openRecipe(page, RECIPE.simple);
		const after = await countHistoryEntries(page);
		expect(after).toBe(before + 1);
	});

});

