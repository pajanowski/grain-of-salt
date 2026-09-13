/**
 * E2E tests for direction ingredient references.
 *
 * Tests the #uuid syntax in direction bodies: typing # triggers the
 * ingredient picker, picking an ingredient inserts #<uuid> into the body,
 * and on save/reload the compiled chip ("Sugar (1 cup)") is visible
 * instead of the raw #uuid token.
 *
 * Fixture: one recipe owned by TEST_USER_ID, created in beforeAll,
 * with a single "Sugar 1 cup" ingredient. Tests reuse this recipe
 * (which starts empty aside from the ingredient).
 *
 * The Sugar ingredient UUID is not known ahead; all picker interactions
 * use name-based selection.
 */
import { expect, type Page, test } from '@playwright/test';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { TEST_USER_ID } from './helpers/auth-shared';
import { v4 as uuidv4 } from 'uuid';
import {
	getDirectionBodyInput,
	getDirectionRow,
	pickIngredientFromDirection,
	getRecipeLink,
	getRecipeHeading,
	getIngredientNameInput,
	getAddButton,
	fillAddDirection,
	submitAddDirection,
	clickPageSave,
	openEditDirectionForm,
	submitEditDirection
} from './helpers/page-utils';

// The Remove row action shows a `window.confirm` dialog.
test.beforeEach(async ({ page }) => {
	page.on('dialog', async (dialog) => {
		await dialog.accept();
	});
});

test.describe.configure({ retries: 0 });

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

/** Unique recipe name for this test file — avoids collisions with parallel runs. */
const RECIPE_NAME = `Direction Ing Ref Test ${uuidv4()}`;
const SUGAR_NAME = 'Sugar';
const SUGAR_AMOUNT = '1';
const SUGAR_UNIT = 'cup';
const SALT_NAME = 'Salt';
const SALT_AMOUNT = '1';
const SALT_UNIT = 'tsp';

async function setupFixture(db: PostgresJsDatabase, ownerId: string) {
	// Idempotent teardown.
	await db.execute(
		sql.raw(
			`delete from public.recipe_nodes where owner_id = '${ownerId}' and name = '${RECIPE_NAME.replace(/'/g, "''")}'`
		)
	);

	const nodeId = uuidv4();
	const sugarId = uuidv4();
	const saltId = uuidv4();

	const ingredientChanges = [
		{
			id: uuidv4(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { id: sugarId, name: SUGAR_NAME, amount: 1, unit: SUGAR_UNIT }
		}
	];

	// No directions yet — each test adds its own.
	const toJsonb = (v: unknown) => sql.raw(`'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`);

	await db.execute(sql`
		insert into public.recipe_nodes (
			id, parent_id, owner_id,
			name, ingredient_changes, direction_changes
		) values (
			${nodeId}::uuid,
			null::uuid,
			${ownerId}::uuid,
			${RECIPE_NAME},
			${toJsonb(ingredientChanges)},
			${toJsonb([])}
		)
	`);

	return { nodeId, sugarId, saltId };
}

let fixtureNodeId: string;

test.beforeAll(async () => {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) throw new Error('DATABASE_URL must be set');
	const client = postgres(dbUrl, { prepare: false });
	const db = drizzle(client);
	try {
		const result = await setupFixture(db, TEST_USER_ID);
		fixtureNodeId = result.nodeId;
		console.log('[e2e direction-ingredient-ref] Fixture created:', fixtureNodeId);
	} finally {
		await client.end();
	}
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Navigate to the fixture recipe's detail page.
async function openFixtureRecipe(page: Page) {
	await page.goto('/mise');
	await expect(getRecipeLink(page, RECIPE_NAME)).toBeVisible();
	await getRecipeLink(page, RECIPE_NAME).click();
	await expect(getRecipeHeading(page, RECIPE_NAME)).toBeVisible();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('direction ingredient references', () => {
	test('add direction with ingredient reference, save, reload, see compiled chip', async ({
		page
	}) => {
		await openFixtureRecipe(page);

		// Add a direction: type #, pick Sugar, complete body.
		await fillAddDirection(page, `#${SUGAR_NAME} to the bowl.`);
		// After typing # the picker should appear; pick Sugar.
		await pickIngredientFromDirection(page, SUGAR_NAME);
		// The textarea should now contain #<uuid> for Sugar.
		const textarea = getDirectionBodyInput(page);
		await expect(textarea).toHaveValue(/#[0-9a-f-]{36}.*to the bowl\./i);

		await submitAddDirection(page);
		await clickPageSave(page);

		// Reload and verify the chip is rendered, not the raw #uuid.
		await page.reload();
		await expect(getRecipeHeading(page, RECIPE_NAME)).toBeVisible();

		// The compiled chip shows the ingredient name and amount.
		// The chip text format is "Ingredient (amount unit)" when both are present.
		await expect(getDirectionRow(page, 0)).toContainText(
			new RegExp(`${SUGAR_NAME}\\s*\\(${SUGAR_AMOUNT}\\s+${SUGAR_UNIT}\\)`, 'i')
		);
		// The raw #uuid must not be visible in the rendered direction body.
		await expect(getDirectionRow(page, 0)).not.toContainText(/#[0-9a-f-]{36}/i);
	});

	test('edit direction: change ingredient reference', async ({ page }) => {
		await openFixtureRecipe(page);

		// Add a second ingredient (Salt) so we have something to change to.
		// The Sugar direction already exists from the previous test, but we
		// can add Salt fresh here (previous test already saved).
		await page
			.getByText('Ingredients')
			.locator('..')
			.getByRole('button', { name: 'Add', exact: true })
			.click();
		await expect(getIngredientNameInput(page)).toBeVisible();
		await getIngredientNameInput(page).fill(SALT_NAME);
		await page.getByPlaceholder('Amount').fill(SALT_AMOUNT);
		await page.getByPlaceholder('Unit').fill(SALT_UNIT);
		await getAddButton(
			page
				.locator('form')
				.filter({ has: getIngredientNameInput(page) })
				.first()
		).click();

		// Edit the existing direction (index 0) — click its row's Change action.
		await openEditDirectionForm(page, getDirectionRow(page, 0));

		// The editing textarea shows the raw #sugar-uuid.
		const textarea = page.locator('textarea[data-editing-direction]');

		// The chip overlay shows "Change" and "Remove" buttons.
		// Click "Change" on the Sugar chip.
		const chipRow = getDirectionRow(page, 0);
		await chipRow.getByRole('button', { name: 'Change' }).click();

		// Picker opens — select Salt.
		await pickIngredientFromDirection(page, SALT_NAME);

		// The textarea should now have the Salt uuid.
		await expect(textarea).toHaveValue(/#[0-9a-f-]{36}.*to the bowl\./i);

		await submitEditDirection(page);
		await clickPageSave(page);

		await page.reload();
		await expect(getRecipeHeading(page, RECIPE_NAME)).toBeVisible();

		// Salt chip should be visible, not Sugar.
		await expect(getDirectionRow(page, 0)).toContainText(
			new RegExp(`${SALT_NAME}\\s*\\(${SALT_AMOUNT}\\s+${SALT_UNIT}\\)`, 'i')
		);
		await expect(getDirectionRow(page, 0)).not.toContainText(
			new RegExp(`${SUGAR_NAME}\\s*\\(${SUGAR_AMOUNT}\\s+${SUGAR_UNIT}\\)`, 'i')
		);
	});

	test('edit direction: remove ingredient reference', async ({ page }) => {
		await openFixtureRecipe(page);

		// Edit direction 0 and click Remove on its chip.
		await openEditDirectionForm(page, getDirectionRow(page, 0));

		const chipRow = getDirectionRow(page, 0);
		await chipRow.getByRole('button', { name: 'Remove' }).click();

		// After Remove, the textarea body should no longer contain #uuid.
		const textarea = page.locator('textarea[data-editing-direction]');
		await expect(textarea).not.toContainText(/#[0-9a-f-]{36}/i);

		await submitEditDirection(page);
		await clickPageSave(page);

		await page.reload();
		await expect(getRecipeHeading(page, RECIPE_NAME)).toBeVisible();

		// The direction row should not contain any compiled chip for Sugar.
		await expect(getDirectionRow(page, 0)).not.toContainText(new RegExp(`${SUGAR_NAME}\\s*\\(`, 'i'));
	});

	test('public page shows compiled chips', async ({ page }) => {
		// The fixture recipe should already be public or we make it public.
		// First, ensure the direction with Sugar ref exists (add it if needed).
		await openFixtureRecipe(page);

		// Add direction with Sugar reference if not already present from prior tests.
		const existingDirectionWithRef = await getDirectionRow(page, 0)
			.getByRole('button', { name: 'Change' })
			.count();
		if (existingDirectionWithRef === 0) {
			await fillAddDirection(page, `#${SUGAR_NAME} to the bowl.`);
			await pickIngredientFromDirection(page, SUGAR_NAME);
			await submitAddDirection(page);
			await clickPageSave(page);
		}

		// Make the recipe public via the API.
		await page.goto(`/mise/recipes/${fixtureNodeId}`);
		const publicResponse = page.waitForResponse(
			(r) => r.url().includes(`/mise/api/recipe-node/${fixtureNodeId}/public`) && r.status() === 200
		);
		await page.getByRole('button', { name: 'Recipe actions' }).click();
		await page.getByRole('menuitem', { name: 'Make public' }).click();
		await publicResponse;

		// Navigate to public page.
		await page.goto(`/recipe/${fixtureNodeId}`);
		await expect(page.getByRole('heading', { name: RECIPE_NAME })).toBeVisible();

		// The public page should render compiled chips, not raw #uuid tokens.
		await expect(page.getByTestId('direction-list').locator('li').first()).toContainText(
			new RegExp(`${SUGAR_NAME}\\s*\\(${SUGAR_AMOUNT}\\s+${SUGAR_UNIT}\\)`, 'i')
		);
		await expect(page.getByTestId('direction-list').locator('li').first()).not.toContainText(
			/#[0-9a-f-]{36}/i
		);
	});

	test('unknown uuid renders as raw text', async ({ page }) => {
		await openFixtureRecipe(page);

		// Manually type a fake #uuid (not matching any ingredient) into the direction.
		await fillAddDirection(page, 'Add #fake-uuid-0000-0000-0000-000000000001 to the bowl.');
		// Do NOT pick from the picker — just type the #uuid literally.
		await submitAddDirection(page);
		await clickPageSave(page);

		await page.reload();
		await expect(getRecipeHeading(page, RECIPE_NAME)).toBeVisible();

		// The raw #fake-uuid should be visible as plain text, not a chip.
		await expect(getDirectionRow(page, 0)).toContainText('#fake-uuid-0000-0000-0000-000000000001');
	});
});
