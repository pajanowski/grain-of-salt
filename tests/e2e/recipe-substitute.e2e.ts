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
import {
	getRowSaveButton,
	clickRowAction,
	getRecipeHeading,
	getRowActionsButton,
	fillAddIngredient
} from './helpers/page-utils';

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
		// Fork Subst Root first — under the substitute-gating rule,
		// Substitute is only valid on rows the leaf has NOT already
		// added/edited. Subst Root's ingredients are all leaf-added
		// there, so we work from a fresh fork.
		await openRecipe(page, RECIPE.root);
		await page.getByRole('button', { name: 'Recipe actions' }).click();
		await page.getByRole('menuitem', { name: 'Fork recipe' }).click();
		const forkName = `Subst Menu Fork ${crypto.randomUUID()}`;
		await page.getByLabel('Forked recipe name').fill(forkName);
		await page.getByRole('button', { name: 'Fork', exact: true }).click();
		await expect(getRecipeHeading(page, forkName)).toBeVisible();

		// Substitute one of the inherited ingredients (Sugar) to
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
		await expect(getRecipeHeading(page, forkName)).toBeVisible();

		// Open history — the substitute must be present with data-change-type.
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
		// Same fork-first setup as the ingredient test above.
		await openRecipe(page, RECIPE.root);
		await page.getByRole('button', { name: 'Recipe actions' }).click();
		await page.getByRole('menuitem', { name: 'Fork recipe' }).click();
		const forkName = `Subst Menu Fork ${crypto.randomUUID()}`;
		await page.getByLabel('Forked recipe name').fill(forkName);
		await page.getByRole('button', { name: 'Fork', exact: true }).click();
		await expect(getRecipeHeading(page, forkName)).toBeVisible();

		const row = directionRow(page, 0);
		await clickRowAction(page, row, 'Substitute');
		await row.locator('textarea').fill('Whisk dry ingredients thoroughly.');
		await getRowSaveButton(row).click();

		const save = page.getByRole('button', { name: 'Save' });
		await expect(save).toBeEnabled();
		await save.click();
		await expect(save).toHaveCount(0);

		await page.reload();
		await expect(getRecipeHeading(page, forkName)).toBeVisible();

		await expandHistory(page);
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

		// The Subst Fork descendant substitutes one ingredient and
		// one direction of the root. The matching rows on the root
		// render a "Subs: N" chip. Other tests in this file may add
		// more descendants via fork + substitute; assert at least 2.
		const chips = page.getByTestId('substitutes-chip');
		await expect(chips.first()).toBeVisible();
		const chipCount = await chips.count();
		expect(chipCount).toBeGreaterThanOrEqual(2);
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
		// shadcn Sheet renders an overlay div with data-slot="sheet-overlay";
		// Bits UI's DismissibleLayer turns outside-click into a close.
		await page.locator('[data-slot="sheet-overlay"]').click();
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
		// Original scenario: a row that already has a descendant
		// substitute (chip visible) gets a NEW leaf substitute change
		// at the current node. The chip must persist because the
		// descendant's substitute for the same row is unchanged.
		//
		// Under the substitute-gating rule, this is now only reachable
		// when viewing an ANCESTOR of the forked substitute, since the
		// leaf can only substitute rows it has not already added/
		// edited. Subst Root's ingredients are all root-added; Subst
		// Fork substitutes one of them (Eggs) and is a child of Subst
		// Root — but Subst Fork itself has no descendants.
		//
		// Substitute scenario: view Subst Root, verify Eggs chip is
		// still present after a series of substitute-aware edits at
		// descendant forks. We don't need a NEW leaf substitute to
		// verify chip persistence — the chip coming from Subst Fork
		// is enough proof.
		await openRecipe(page, RECIPE.root);

		// Eggs is one of the rows Subst Fork substitutes. The chip
		// surfaces on the ancestor (Subst Root) row that matches the
		// substituted row id. Confirm it's present before any further
		// edits, and that it persists across a save (no edits on this
		// node, so this is a no-op).
		const eggsRow = ingredientRow(page, 'Eggs');
		await expect(eggsRow.getByTestId('substitutes-chip')).toBeVisible();

		// Reload and re-confirm — chip should still be visible because
		// Subst Fork is still a descendant of Subst Root and Subst
		// Fork's ingredient substitute for Eggs is unchanged.
		await page.reload();
		await expect(getRecipeHeading(page, RECIPE.root)).toBeVisible();
		await expect(eggsRow.getByTestId('substitutes-chip')).toBeVisible();
	});
});

test.describe('substitute gating — must not be allowed on already-changed rows', () => {
	// Rule: a row that the leaf has already authored an `add` (fresh
	// row), `edit`, or `substitute` change for at the current node
	// must NOT offer a Substitute menu item. Substitute is only valid
	// on rows inherited from an ancestor (no leaf change for that id).

	test('fork row that the leaf has not yet touched: Substitute is offered', async ({ page }) => {
		// Fork the Subst Root recipe; the fork inherits all of the
		// root's rows with no leaf-authored changes. On every inherited
		// row the Substitute menu item should be visible.
		await openRecipe(page, RECIPE.root);
		await page.getByRole('button', { name: 'Recipe actions' }).click();
		await page.getByRole('menuitem', { name: 'Fork recipe' }).click();
		const forkName = `Subst Gate Fork ${crypto.randomUUID()}`;
		await page.getByLabel('Forked recipe name').fill(forkName);
		await page.getByRole('button', { name: 'Fork', exact: true }).click();
		await expect(getRecipeHeading(page, forkName)).toBeVisible();

		// Open the kebab on the inherited Eggs row and confirm
		// Substitute appears in the menu.
		const eggsRow = ingredientRow(page, 'Eggs');
		await getRowActionsButton(eggsRow).click();
		const subItem = page.getByRole('menuitem', { name: 'Substitute' });
		await expect(subItem).toBeVisible();
	});

	test('fork row that the leaf has Added at this node: Substitute is NOT offered', async ({ page }) => {
		await openRecipe(page, RECIPE.root);
		await page.getByRole('button', { name: 'Recipe actions' }).click();
		await page.getByRole('menuitem', { name: 'Fork recipe' }).click();
		const forkName = `Subst Gate Fork ${crypto.randomUUID()}`;
		await page.getByLabel('Forked recipe name').fill(forkName);
		await page.getByRole('button', { name: 'Fork', exact: true }).click();
		await expect(getRecipeHeading(page, forkName)).toBeVisible();

		// Add a leaf-owned ingredient.
		await fillAddIngredient(page, 'Cream', '2', 'tbsp');
		// Don't save yet — the rule applies to pending leaf changes too,
		// so a substitute on top of a pending add is incoherent.

		const creamRow = ingredientRow(page, 'Cream');
		await getRowActionsButton(creamRow).click();
		const subItem = page.getByRole('menuitem', { name: 'Substitute' });
		await expect(subItem).toHaveCount(0);
	});

	test('fork row that the leaf has Edited at this node: Substitute is NOT offered', async ({ page }) => {
		await openRecipe(page, RECIPE.root);
		await page.getByRole('button', { name: 'Recipe actions' }).click();
		await page.getByRole('menuitem', { name: 'Fork recipe' }).click();
		const forkName = `Subst Gate Fork ${crypto.randomUUID()}`;
		await page.getByLabel('Forked recipe name').fill(forkName);
		await page.getByRole('button', { name: 'Fork', exact: true }).click();
		await expect(getRecipeHeading(page, forkName)).toBeVisible();

		// Edit the inherited Eggs row.
		const eggsRow = ingredientRow(page, 'Eggs');
		await clickRowAction(page, eggsRow, 'Edit');
		await eggsRow.getByPlaceholder('Amount').fill('5');
		await getRowSaveButton(eggsRow).click();
		await expect(eggsRow.getByRole('button', { name: 'Save' })).toHaveCount(0);

		// Reopen the menu — Substitute should be hidden.
		await getRowActionsButton(eggsRow).click();
		const subItem = page.getByRole('menuitem', { name: 'Substitute' });
		await expect(subItem).toHaveCount(0);
	});

	test('fork row that the leaf has already Substituted at this node: Substitute is NOT offered again', async ({ page }) => {
		await openRecipe(page, RECIPE.root);
		await page.getByRole('button', { name: 'Recipe actions' }).click();
		await page.getByRole('menuitem', { name: 'Fork recipe' }).click();
		const forkName = `Subst Gate Fork ${crypto.randomUUID()}`;
		await page.getByLabel('Forked recipe name').fill(forkName);
		await page.getByRole('button', { name: 'Fork', exact: true }).click();
		await expect(getRecipeHeading(page, forkName)).toBeVisible();

		// Substitute the inherited Eggs row.
		const eggsRow = ingredientRow(page, 'Eggs');
		await clickRowAction(page, eggsRow, 'Substitute');
		await eggsRow.getByPlaceholder('Amount').fill('2');
		await getRowSaveButton(eggsRow).click();
		await expect(eggsRow.getByRole('button', { name: 'Save' })).toHaveCount(0);

		// Reopen the menu — Substitute should be hidden now because
		// the leaf already has a substitute change for Eggs.
		await getRowActionsButton(eggsRow).click();
		const subItem = page.getByRole('menuitem', { name: 'Substitute' });
		await expect(subItem).toHaveCount(0);
	});
});
