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
	getChipInTextBox,
	getDirectionBodyInput,
	getDirectionList,
	getDirectionRow,
	pickIngredientFromDirection,
	getRecipeLink,
	getRecipeHeading,
	getIngredientNameInput,
	getAddButton,
	fillAddDirection,
	fillAddDirectionWithIngredient,
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
// Salt is added via UnitAutocomplete which normalizes "tsp" -> "teaspoon".
const SALT_DISPLAY_UNIT = 'teaspoon';

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
		// We type the `#name` prefix char-by-char so the picker can detect
		// the `#`-token via its oninput handler; a single .fill() of the full
		// string breaks that detection because the trailing whitespace
		// invalidates the `#xxx$` regex match.
		await fillAddDirectionWithIngredient(
			page,
			`#${SUGAR_NAME}`,
			SUGAR_NAME,
			' to the bowl.'
		);
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

		// Ensure a Sugar direction exists for this test to edit (test 1 may
		// or may not have run before us in this invocation).
		const existingSugar = await getDirectionList(page)
			.getByText(new RegExp(`${SUGAR_NAME}\\s*\\(${SUGAR_AMOUNT}\\s+${SUGAR_UNIT}\\)`, 'i'))
			.count();
		if (existingSugar === 0) {
			await fillAddDirectionWithIngredient(
				page,
				`#${SUGAR_NAME}`,
				SUGAR_NAME,
				' to the bowl.'
			);
			await submitAddDirection(page);
			await clickPageSave(page);
			await page.reload();
			await expect(getRecipeHeading(page, RECIPE_NAME)).toBeVisible();
		}

		// Add a second ingredient (Salt) so we have something to change to.
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

		// Edit the existing Sugar direction — click its row's Change action.
		const sugarRow = getDirectionList(page)
			.locator('li')
			.filter({ hasText: new RegExp(`${SUGAR_NAME}\\s*\\(${SUGAR_AMOUNT}\\s+${SUGAR_UNIT}\\)`, 'i') })
			.first();
		await openEditDirectionForm(page, sugarRow);

		// The editing textarea shows the raw #sugar-uuid.
		const textarea = page.locator('textarea[data-editing-direction]');

		// Blur the textarea so the chip overlay becomes visible (overlay is
		// hidden while the textarea is focused so caret positioning works).
		await textarea.blur();

		// The chip overlay shows "Change" and "Remove" buttons. The overlay
		// has aria-hidden="true", so getByRole filters the buttons out — use
		// a text locator inside the chip span instead.
		await page
			.locator('textarea[data-editing-direction]')
			.locator('..')
			.getByText('Change', { exact: true })
			.first()
			.click();

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
			new RegExp(`${SALT_NAME}\\s*\\(${SALT_AMOUNT}\\s+${SALT_DISPLAY_UNIT}\\)`, 'i')
		);
		await expect(getDirectionRow(page, 0)).not.toContainText(
			new RegExp(`${SUGAR_NAME}\\s*\\(${SUGAR_AMOUNT}\\s+${SUGAR_UNIT}\\)`, 'i')
		);
	});

	test('edit direction: remove ingredient reference', async ({ page }) => {
		await openFixtureRecipe(page);

		// Ensure a Sugar direction exists for this test to edit. Test 2
		// may have changed an existing Sugar direction to Salt, so we add
		// a fresh one if needed.
		const existingSugar = await getDirectionList(page)
			.getByText(new RegExp(`${SUGAR_NAME}\\s*\\(${SUGAR_AMOUNT}\\s+${SUGAR_UNIT}\\)`, 'i'))
			.count();
		if (existingSugar === 0) {
			await fillAddDirectionWithIngredient(
				page,
				`#${SUGAR_NAME}`,
				SUGAR_NAME,
				' to the bowl.'
			);
			await submitAddDirection(page);
			await clickPageSave(page);
			await page.reload();
			await expect(getRecipeHeading(page, RECIPE_NAME)).toBeVisible();
		}

		// Find the direction row that contains the Sugar chip and edit it.
		const sugarRow = getDirectionList(page)
			.locator('li')
			.filter({ hasText: new RegExp(`${SUGAR_NAME}\\s*\\(${SUGAR_AMOUNT}\\s+${SUGAR_UNIT}\\)`, 'i') })
			.first();
		await openEditDirectionForm(page, sugarRow);

		// Blur the textarea so the chip overlay becomes visible (overlay is
		// hidden while the textarea is focused).
		const textarea = page.locator('textarea[data-editing-direction]');
		await textarea.blur();

		// The chip overlay should currently show Sugar (1 cup).
		await expect(
			getChipInTextBox(page, new RegExp(`${SUGAR_NAME}\\s*\\(${SUGAR_AMOUNT}\\s+${SUGAR_UNIT}\\)`, 'i'))
		).toBeVisible();

		// The overlay is aria-hidden so getByRole skips the button; use a
		// text locator inside the editing form instead.
		await page
			.locator('textarea[data-editing-direction]')
			.locator('..')
			.getByText('Remove', { exact: true })
			.first()
			.click();

		// After Remove, the chip should be gone from the overlay and the
		// textarea body should no longer contain #uuid.
		await expect(
			getChipInTextBox(page, new RegExp(`${SUGAR_NAME}\\s*\\(${SUGAR_AMOUNT}\\s+${SUGAR_UNIT}\\)`, 'i'))
		).toHaveCount(0);
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
		// Ensure a fresh Sugar direction exists (prior tests may have left
		// the first row pointing at a different ingredient, e.g. Salt).
		await openFixtureRecipe(page);

		// Count existing Sugar-direction rows.
		const sugarCount = await getDirectionList(page)
			.locator('li')
			.filter({ hasText: new RegExp(`${SUGAR_NAME}\\s*\\(${SUGAR_AMOUNT}\\s+${SUGAR_UNIT}\\)`, 'i') })
			.count();
		if (sugarCount === 0) {
			await fillAddDirectionWithIngredient(
				page,
				`#${SUGAR_NAME}`,
				SUGAR_NAME,
				' to the bowl.'
			);
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

		// The public page should render compiled chips for the Sugar row,
		// not raw #uuid tokens. We locate the row that contains the Sugar
		// chip rather than assuming it's at index 0.
		const sugarLi = page
			.getByTestId('direction-list')
			.locator('li')
			.filter({ hasText: new RegExp(`${SUGAR_NAME}\\s*\\(${SUGAR_AMOUNT}\\s+${SUGAR_UNIT}\\)`, 'i') })
			.first();
		await expect(sugarLi).toBeVisible();
		await expect(sugarLi).not.toContainText(/#[0-9a-f-]{36}/i);
	});

	test('unknown uuid renders as raw text', async ({ page }) => {
		await openFixtureRecipe(page);

		// Manually type a fake #uuid (not matching any ingredient) into the
		// direction. fill() bypasses the picker (the matcher still runs but
		// no real ingredient matches "fake-uuid-...", so the picker stays
		// empty and the text is submitted as plain body text).
		await fillAddDirection(page, '#fake-uuid-0000-0000-0000-000000000001 to the bowl.');
		// Do NOT pick from the picker — just type the #uuid literally.
		await submitAddDirection(page);
		await clickPageSave(page);

		await page.reload();
		await expect(getRecipeHeading(page, RECIPE_NAME)).toBeVisible();

		// The raw #fake-uuid should be visible as plain text somewhere in the
		// direction list, not as a chip. Other tests may have added directions
		// before this one ran, so we don't assume a particular index.
		await expect(getDirectionList(page)).toContainText(
			'#fake-uuid-0000-0000-0000-000000000001'
		);
	});
});
