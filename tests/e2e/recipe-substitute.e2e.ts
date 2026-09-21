/**
 * E2E tests for the 'substitute' change type — syntactic sugar over
 * 'edit' with the same wire shape but a distinct UI label (blue SUB
 * badge) and a dedicated row menu item ("Substitute").
 *
 * Coverage:
 *  1. Substitute appears in NodeChanges with the blue styling and
 *     data-change-type="substitute".
 *  2. Substitute appears in RecipeHistory (collapsed by default;
 *     expand before asserting) with the blue background.
 *  3. Substitute appears on the recipe graph (RecipeNodeCard) with
 *     data-change-type="substitute".
 *  4. The Substitute row menu item opens the same edit form and saves
 *     with changeType 'substitute' (not 'edit').
 *  5. A descendant substitute surfaces in the "Substitutes available"
 *     panel on the ancestor's recipe page with a link to the source
 *     descendant node.
 *
 * Fixture: a 3-node tree under TEST_USER_ID:
 *
 *   Subst Root        (3 ingredients + 1 direction as initial content)
 *   └── Subst Fork    (carries a substitute change for one ingredient
 *                       and one direction — exercises the panel and the
 *                       row substitute action)
 *
 * The fork's substitute references a row that exists in the root, so
 * the descendant crawler surfaces it when viewing the root.
 */
import { expect, type Page, test } from '@playwright/test';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { TEST_USER_ID } from './helpers/auth-shared';
import { v4 as uuidv4 } from 'uuid';
import { getRowSaveButton, clickRowAction, getRecipeHeading } from './helpers/page-utils';

test.beforeEach(async ({ page }) => {
	// The Substitute row action opens the same edit form as Edit; both
	// eventually hit a `window.confirm` only on Remove. No confirm is
	// needed for the substitute path, but register an accept handler
	// to be defensive in case a future row interaction triggers one.
	page.on('dialog', async (dialog) => {
		await dialog.accept();
	});
});

test.describe.configure({ retries: 0 });

const RECIPE = {
	root: 'Subst Root',
	fork: 'Subst Fork'
} as const;

const FIXTURE_NAMES = [RECIPE.root, RECIPE.fork] as const;

// Resolved in beforeAll from the inserted rows; the recipe slugs are the
// node ids. Used by the graph test where the URL needs a uuid, not a name.
let ROOT_ID: string;
let FORK_ID: string;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error('DATABASE_URL must be set for e2e tests to run');
}

async function setupSubstituteFixture(
	db: PostgresJsDatabase,
	testOwnerId: string
): Promise<{ rootId: string; forkId: string }> {
	const nameList = `(${FIXTURE_NAMES.map((n) => `'${n.replace(/'/g, "''")}'`).join(',')})`;
	await db.execute(
		sql.raw(
			`delete from public.recipe_nodes where owner_id = '${testOwnerId}' and name in ${nameList}`
		)
	);

	const rootId = uuidv4();
	const forkId = uuidv4();

	const eggId = uuidv4();
	const flourId = uuidv4();
	const sugarId = uuidv4();
	const rootIngredientChanges = [
		{
			id: uuidv4(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { id: eggId, name: 'Eggs', amount: 2, unit: 'whole' }
		},
		{
			id: uuidv4(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { id: flourId, name: 'Flour', amount: 250, unit: 'g' }
		},
		{
			id: uuidv4(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { id: sugarId, name: 'Sugar', amount: 100, unit: 'g' }
		}
	];

	const mixId = uuidv4();
	const rootDirectionChanges = [
		{
			id: uuidv4(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { id: mixId, body: 'Mix dry ingredients.' }
		}
	];

	// Fork: carries two substitutes — one ingredient (Eggs → Flax eggs),
	// one direction (Mix dry ingredients → Sift dry ingredients).
	const forkIngredientChanges = [
		{
			id: uuidv4(),
			changeType: 'substitute',
			targetId: eggId,
			note: null,
			body: { id: eggId, name: 'Flax eggs', amount: 2, unit: 'tbsp' }
		}
	];
	const forkDirectionChanges = [
		{
			id: uuidv4(),
			changeType: 'substitute',
			targetId: mixId,
			note: null,
			body: { id: mixId, body: 'Sift dry ingredients together.' }
		}
	];

	const toJsonb = (value: unknown) =>
		sql.raw(`'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`);

	const rows: Array<{
		id: string;
		parentId: string | null;
		name: string;
		ingredients: unknown;
		directions: unknown;
	}> = [
		{
			id: rootId,
			parentId: null,
			name: RECIPE.root,
			ingredients: rootIngredientChanges,
			directions: rootDirectionChanges
		},
		{
			id: forkId,
			parentId: rootId,
			name: RECIPE.fork,
			ingredients: forkIngredientChanges,
			directions: forkDirectionChanges
		}
	];

	for (const row of rows) {
		await db.execute(sql`
			insert into public.recipe_nodes (
				id, parent_id, owner_id,
				name, ingredient_changes, direction_changes
			) values (
				${row.id}::uuid,
				${row.parentId}::uuid,
				${testOwnerId}::uuid,
				${row.name},
				${toJsonb(row.ingredients)},
				${toJsonb(row.directions)}
			)
		`);
	}

	return { rootId, forkId };
}

test.beforeAll(async () => {
	const client = postgres(DATABASE_URL, { prepare: false });
	const db = drizzle(client);
	try {
		const ids = await setupSubstituteFixture(db, TEST_USER_ID);
		ROOT_ID = ids.rootId;
		FORK_ID = ids.forkId;
		console.log(
			`[e2e recipe-substitute] Created substitute fixture: root=${ROOT_ID} fork=${FORK_ID}`
		);
	} finally {
		await client.end();
	}
});

async function openRecipe(page: Page, recipeName: string) {
	await page.goto('/mise');
	await expect(page.getByRole('heading', { name: 'Recipe List' })).toBeVisible();
	const link = page
		.getByRole('link', { name: new RegExp(`^\\s*(↳\\s+)?${recipeName}\\b`) })
		.first();
	await expect(link).toBeVisible();
	await link.click();
	await page.waitForURL(/\/recipes\//);
	await expect(getRecipeHeading(page, recipeName)).toBeVisible();
}

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

async function expandHistory(page: Page) {
	const toggle = page.getByTestId('recipe-history').locator('> button').first();
	const expanded = await toggle.getAttribute('aria-expanded');
	if (expanded !== 'true') await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

test.describe('substitute renders with blue badge and data-change-type', () => {
	test('NodeChanges shows the substitute change on the fork with data-change-type="substitute"', async ({
		page
	}) => {
		await openRecipe(page, RECIPE.fork);

		// NodeChanges is the unsaved-changes panel; on a freshly loaded
		// page with no leaf edits it renders empty until the user
		// touches something. The substitute lives on this fork node,
		// so it should already show under "Changes on this node".
		const nodeChanges = page.locator('[data-testid="node-changes"]').first();
		await expect(nodeChanges).toBeVisible();
		const sub = nodeChanges.locator('[data-change-type="substitute"]').first();
		await expect(sub).toBeVisible();
		await expect(sub).toContainText(/SUB/);
	});

	test('RecipeHistory shows the substitute with the blue background', async ({ page }) => {
		await openRecipe(page, RECIPE.fork);
		await expandHistory(page);

		const entries = page.getByTestId('recipe-history').locator('ol#recipe-history-entries');
		const sub = entries.locator('li[data-change-type="substitute"]').first();
		await expect(sub).toBeVisible();
		await expect(sub).toContainText(/SUB/);
		// Blue styling — Tailwind applies the bg-blue-100 utility via
		// class:background-color in Svelte. The computed color resolves
		// to oklch in Tailwind v4, so assert by class membership rather
		// than exact rgb triple.
		const cls = await sub.getAttribute('class');
		expect(cls).toContain('bg-blue-100');
	});

	test('RecipeNodeCard on the graph shows the substitute with data-change-type="substitute"', async ({
		page
	}) => {
		// Navigate directly to the graph for the root using the uuid
		// (the route expects /mise/recipes/[slug] where slug is a node id).
		await page.goto(`/mise/recipes/${ROOT_ID}/graph`);

		// Locate the node card by its data attribute (the recipe name).
		const card = page.locator(
			`[data-testid="recipe-node-card"][data-recipe-node-name="${RECIPE.fork}"]`
		);
		await expect(card).toBeVisible({ timeout: 10_000 });
		const sub = card.locator('[data-change-type="substitute"]').first();
		await expect(sub).toBeVisible();
		await expect(sub).toContainText(/SUB/);
	});
});

test.describe('Substitute row action saves with changeType substitute', () => {
	test('picking Substitute from the ingredient kebab menu saves with substitute changeType', async ({
		page
	}) => {
		await openRecipe(page, RECIPE.root);

		// Substitute one of the root's initial ingredients (Sugar) to
		// confirm the menu item is wired and that the saved change
		// records changeType 'substitute'.
		const row = ingredientRow(page, 'Sugar');
		await clickRowAction(page, row, 'Substitute');

		// Substitute uses the same edit form — fill the row inputs.
		await row.getByPlaceholder('Name').fill('Maple syrup');
		await row.getByPlaceholder('Amount').fill('80');
		await row.getByPlaceholder('Unit').fill('ml');
		await getRowSaveButton(row).click();

		// Save the page.
		const save = page.getByRole('button', { name: 'Save' });
		await expect(save).toBeEnabled();
		await save.click();
		await expect(save).toHaveCount(0);

		// Reload to confirm the change persisted (not just client state).
		await page.reload();
		await expect(getRecipeHeading(page, RECIPE.root)).toBeVisible();

		// Open history — the substitute must be present with data-change-type.
		// Match the new ingredient substitute specifically; the Fork may
		// already carry substitutes from the descendant fixture.
		await expandHistory(page);
		const entries = page.getByTestId('recipe-history').locator('ol#recipe-history-entries');
		const sub = entries.locator('li[data-change-type="substitute"]', {
			hasText: /Maple syrup/
		});
		await expect(sub).toBeVisible();
		await expect(sub).toContainText(/SUB/);
	});

	test('picking Substitute from the direction kebab menu saves with substitute changeType', async ({
		page
	}) => {
		await openRecipe(page, RECIPE.root);

		const row = directionRow(page, 0);
		await clickRowAction(page, row, 'Substitute');
		await row.locator('textarea').fill('Whisk dry ingredients thoroughly.');
		await getRowSaveButton(row).click();

		const save = page.getByRole('button', { name: 'Save' });
		await expect(save).toBeEnabled();
		await save.click();
		await expect(save).toHaveCount(0);

		await page.reload();
		await expect(getRecipeHeading(page, RECIPE.root)).toBeVisible();

		await expandHistory(page);
		// Match the new direction substitute specifically. The Fork may
		// already carry substitute changes from earlier tests (or the
		// descendant panel fixture), and `.first()` would pick the wrong
		// row. Locate the substitute whose rendered body contains the
		// new text.
		const entries = page.getByTestId('recipe-history').locator('ol#recipe-history-entries');
		const sub = entries.locator('li[data-change-type="substitute"]', {
			hasText: /Whisk dry ingredients thoroughly/
		});
		await expect(sub).toBeVisible();
	});
});

test.describe('descendant substitutes row chip + sidebar', () => {
	test('per-row chip appears on ancestor row that descendants substitute', async ({ page }) => {
		await openRecipe(page, RECIPE.root);

		// The fork carries an ingredient substitute and a direction
		// substitute. The root's matching rows must render a "Subs: N"
		// chip. Two rows are substituted → expect 2 chips.
		const chips = page.getByTestId('substitutes-chip');
		await expect(chips).toHaveCount(2);

		// Each chip starts with "Subs: 1" (the fork has exactly one
		// substitute per row).
		await expect(chips.first()).toHaveText(/^Subs: 1$/);
		await expect(chips.nth(1)).toHaveText(/^Subs: 1$/);
	});

	test('clicking chip opens sidebar with descendant substitute and link', async ({ page }) => {
		await openRecipe(page, RECIPE.root);

		const chip = page.getByTestId('substitutes-chip').first();
		await expect(chip).toBeVisible();
		await chip.click();

		// Sidebar renders.
		const panel = page.getByTestId('substitutes-panel');
		await expect(panel).toBeVisible();

		// Sidebar shows the row label and the substitute entry.
		await expect(panel.getByTestId('substitutes-row-label')).toBeVisible();
		const entries = panel.locator('[data-testid="substitute-entry"]');
		await expect(entries).toHaveCount(1);

		// Entry links back to the source descendant node (the fork).
		const link = panel.getByTestId('substitute-source-link');
		await expect(link).toHaveAttribute('href', /\/mise\/recipes\//);
		await expect(link).toContainText(RECIPE.fork);

		// Substitute body text is rendered (Subst Fork swaps the row's
		// value — test asserts the body is non-empty and starts with
		// the SUB prefix).
		const text = panel.getByTestId('substitute-text');
		await expect(text).toHaveText(/^SUB\b/);
	});

	test('sidebar closes via backdrop click', async ({ page }) => {
		await openRecipe(page, RECIPE.root);
		await page.getByTestId('substitutes-chip').first().click();
		const panel = page.getByTestId('substitutes-panel');
		await expect(panel).toBeVisible();
		await page.getByTestId('substitutes-backdrop').click();
		await expect(panel).toHaveCount(0);
	});

	test('sidebar closes via close button', async ({ page }) => {
		await openRecipe(page, RECIPE.root);
		await page.getByTestId('substitutes-chip').first().click();
		const panel = page.getByTestId('substitutes-panel');
		await expect(panel).toBeVisible();
		await page.getByTestId('substitutes-close').click();
		await expect(panel).toHaveCount(0);
	});

	test('sidebar closes via Escape key', async ({ page }) => {
		await openRecipe(page, RECIPE.root);
		await page.getByTestId('substitutes-chip').first().click();
		const panel = page.getByTestId('substitutes-panel');
		await expect(panel).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(panel).toHaveCount(0);
	});

	test('fork itself shows no chip — it has no descendants', async ({ page }) => {
		await openRecipe(page, RECIPE.fork);
		// The fork has no descendants; no row on it surfaces a chip.
		await expect(page.getByTestId('substitutes-chip')).toHaveCount(0);
	});

	test('chip persists after the user substitutes the row themselves', async ({ page }) => {
		await openRecipe(page, RECIPE.root);

		// Sanity: chips visible (the fork substitutes one ingredient and
		// one direction).
		await expect(page.getByTestId('substitutes-chip').first()).toBeVisible();

		// Pick the ingredient row that owns the first chip (the
		// fixture substitutes Eggs) and substitute it ourselves via
		// the kebab. Use the established helper so the menu interaction
		// matches the rest of the suite.
		const ingredientRows = page.locator('[data-testid="ingredient-row"]');
		const ingredientCount = await ingredientRows.count();
		let substituted = false;
		for (let i = 0; i < ingredientCount; i++) {
			const row = ingredientRows.nth(i);
			const chipInRow = row.locator('[data-testid="substitutes-chip"]');
			if ((await chipInRow.count()) === 0) continue;
			// This row already has a descendant substitute — substitute
			// it ourselves. Click kebab → Substitute.
			await clickRowAction(page, row, 'Substitute');
			await row.getByPlaceholder('Name').fill('Banana');
			await row.getByPlaceholder('Amount').fill('1');
			await getRowSaveButton(row).click();
			await expect(row.getByRole('button', { name: 'Save' })).toHaveCount(0);
			substituted = true;
			break;
		}
		expect(substituted).toBe(true);

		// Reload to confirm the chip persists: the leaf now has its
		// own substitute change, but the fork's substitute for the
		// same row id is still descendant — byRowId still has it.
		await page.reload();
		await expect(getRecipeHeading(page, RECIPE.root)).toBeVisible();
		await expect(page.getByTestId('substitutes-chip').first()).toBeVisible();
	});
});
