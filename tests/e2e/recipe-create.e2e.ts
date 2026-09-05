/**
 * E2E tests for the create-recipe UI on the home page.
 *
 * Tests cover the happy path plus the surrounding form behaviour: cancel,
 * state preservation across reopens, sequential creates, navigation,
 * server-error handling, and empty-name submission. Recipe names are
 * fresh uuids so each test is hermetic against the seeded demo tree
 * under TEST_USER_ID — we look up new recipes by exact uuid text.
 *
 * The DB is seeded exactly once per suite by tests/e2e/global-setup.ts;
 * no per-test reset is performed. Recipes created during the suite
 * accumulate across runs (no global teardown cleans them up by design —
 * leave that to a future milestone if it becomes a problem).
 */
import { expect, test, type Page } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

/**
 * Open the inline create-recipe form and assert its input is visible.
 * Every test in this file starts with this step.
 */
async function openCreateForm(page: Page) {
	await page.getByRole('button', { name: 'Create Recipe' }).click();
	await expect(page.locator('form input').first()).toBeVisible();
}

test('create recipe: uuid name appears in the recipe list and persists across reload', async ({
	page
}) => {
	await page.goto('/');

	const recipeName = uuidv4();

	await openCreateForm(page);
	await page.locator('form input').first().fill(recipeName);

	// The handler awaits /api/save, then calls invalidateAll() which re-runs
	// the layout load and re-renders RecipeList with the new entry.
	await page.getByRole('button', { name: 'Create', exact: true }).click();

	// The real post-condition: the new root recipe is rendered as a link in
	// RecipeList. Wait for it instead of racing on form-close.
	await expect(page.getByRole('link', { name: recipeName, exact: true })).toBeVisible();

	// Hard reload to bypass any client cache and read straight from the
	// server. This proves the row was actually persisted to the database,
	// not just optimistically rendered.
	await page.reload();
	await expect(page.getByRole('link', { name: recipeName, exact: true })).toBeVisible();
});

test('cancel closes the form without creating a recipe', async ({ page }) => {
	await page.goto('/');

	const recipeName = uuidv4();

	await openCreateForm(page);
	await page.locator('form input').first().fill(recipeName);

	await page.getByRole('button', { name: 'Cancel' }).click();

	// Form is gone (no <input> inside any <form>), and the new recipe
	// never made it to the list.
	await expect(page.locator('form input')).toHaveCount(0);
	await expect(page.getByRole('link', { name: recipeName, exact: true })).toHaveCount(0);
});

test('cancel clears the form so a reopen starts blank', async ({ page }) => {
	await page.goto('/');

	await openCreateForm(page);
	await page.locator('form input').first().fill('first attempt');

	await page.getByRole('button', { name: 'Cancel' }).click();

	// Reopen — the Cancel handler reset `newRecipeName` to '', so the
	// fresh input is empty. Without that reset, a stale value would
	// silently pre-fill the next create.
	await openCreateForm(page);
	await expect(page.locator('form input').first()).toHaveValue('');
});

test('creating two recipes in sequence makes both visible in the list', async ({
	page
}) => {
	await page.goto('/');

	const nameA = uuidv4();
	const nameB = uuidv4();

	// Create A — form closes after submit.
	await openCreateForm(page);
	await page.locator('form input').first().fill(nameA);
	await page.getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page.getByRole('link', { name: nameA, exact: true })).toBeVisible();

	// Create B — reopen the form first. (.fill() overwrites whatever the
	// input shows, so a stale value from the previous create wouldn't
	// derail this test even if the handler doesn't clear it.)
	await openCreateForm(page);
	await page.locator('form input').first().fill(nameB);
	await page.getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page.getByRole('link', { name: nameB, exact: true })).toBeVisible();

	// Both recipes still present in the tree.
	await expect(page.getByRole('link', { name: nameA, exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: nameB, exact: true })).toBeVisible();
});

test('clicking the new recipe link navigates to its detail page', async ({ page }) => {
	await page.goto('/');

	const recipeName = uuidv4();

	await openCreateForm(page);
	await page.locator('form input').first().fill(recipeName);
	await page.getByRole('button', { name: 'Create', exact: true }).click();

	const newRecipeLink = page.getByRole('link', { name: recipeName, exact: true });
	await expect(newRecipeLink).toBeVisible();

	// Recipe identity is the root node's id; the link href is
	// `/recipes/{node.id}` and the detail page renders a heading of the
	// form "Recipe: <name>".
	await newRecipeLink.click();
	await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]+/);
	await expect(page.getByRole('heading', { name: `Recipe: ${recipeName}` })).toBeVisible();
});

test('server failure during save closes the form but does not add the recipe', async ({
	page
}) => {

	// Stub POST /api/save to return 500. The page's fetch handler ignores
	// res.ok and unconditionally calls invalidateAll() + closes the form,
	// so the current observable behaviour is "form still closes, recipe
	// never appears." This test pins that behaviour; if the handler is
	// ever fixed to surface errors, the "no recipe in list" assertion
	// still holds.
	await page.route('**/api/save', (route) => {
		route.fulfill({ status: 500, body: 'simulated server error' });
	});

	await page.goto('/');

	const recipeName = uuidv4();

	await openCreateForm(page);
	await page.locator('form input').first().fill(recipeName);
	await page.getByRole('button', { name: 'Create', exact: true }).click();

	await expect(page.locator('form input')).toHaveCount(0);
	await expect(page.getByRole('link', { name: recipeName, exact: true })).toHaveCount(0);
});

test('submitting an empty name creates an unnamed recipe (current behaviour)', async ({
	page
}) => {
	await page.goto('/');

	// Count via the DOM href selector rather than getByRole('link') —
	// a link with no accessible text (empty name) doesn't appear in the
	// accessibility tree, so getByRole('link').count() would skip it.
	// The RecipeList is the only place under / that renders
	// <a href="/recipes/...">, so this counts exactly the recipe rows.
	const linksBefore = await page.locator('a[href^="/recipes/"]').count();

	await openCreateForm(page);
	// Intentionally do not fill — leave input blank.
	await page.getByRole('button', { name: 'Create', exact: true }).click();

	// Form closes (current behaviour — no client-side guard).
	await expect(page.locator('form input')).toHaveCount(0);

	// Wait for the layout to reload — invalidateAll() inside the save
	// handler is async, so the empty-named recipe row appears on the
	// next tick after the form closes.
	await expect.poll(
		() => page.locator('a[href^="/recipes/"]').count(),
		{ timeout: 5000 }
	).toBe(linksBefore + 1);
});
