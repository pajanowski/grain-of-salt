/**
 * E2E tests for the recipe-image URL on the recipe detail page.
 *
 * Background: the cover image, per-row ingredient images, per-row
 * direction images, and the lightbox viewer all render via `<img
 * src="/mise/api/image?path=...">`, which is the signed-URL gateway
 * endpoint at `/mise/api/image/+server.ts`. Earlier the same `<img>`
 * elements pointed at the wrong path (`/api/image` without the `/mise`
 * prefix), which made every uploaded image return 404 from the page
 * and rendered as a broken-image placeholder ("question mark icon")
 * on every surface — cover, per-row, lightbox — and on every viewport
 * size. This file covers that fix end-to-end.
 *
 * What "broken image" actually means on the page:
 *  1. The owner uploads a file via the file picker.
 *  2. The POST stores a path on `recipe_nodes.image_path` (cover) or
 *     on the change record's `body.imagePaths` (per-row).
 *  3. On render, the `<img>` requests `/mise/api/image?path=...`.
 *     That endpoint mints a signed URL and 302-redirects to it.
 *  4. With the wrong prefix, step 3 hits a 404 → the browser shows the
 *     broken-image placeholder; on touch devices that renders
 *     particularly badly because no alt tooltip is shown.
 *
 * Tests here drive the upload via the file picker and assert on the
 * rendered image's reachability + rendered size (naturalWidth > 0)
 * after a hard reload (so SSR/fetched URLs are equally tested).
 */
import { expect, type Page, test } from '@playwright/test';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { v4 as uuidv4 } from 'uuid';
import { TEST_USER_ID } from './helpers/auth-shared';
import {
	clickRowAction,
	directionRowByIndex,
	getRecipeHeading,
	getRecipeLink,
	getRowSaveButton,
	ingredientRowByName
} from './helpers/page-utils';

// Minimal 1x1 transparent PNG, valid for upload to the storage bucket.
const TINY_PNG = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xf8, 0xff, 0xff, 0x3f,
	0x03, 0x00, 0x05, 0xfe, 0x02, 0xfe, 0xa3, 0x53, 0x9a, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
	0x44, 0xae, 0x42, 0x60, 0x82
]);

const RECIPE = {
	root: 'Cover Image Root'
} as const;
const FIXTURE_NAMES = [RECIPE.root] as const;

let ROOT_ID: string;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error('DATABASE_URL must be set for e2e tests to run');
}

/**
 * Build a fixture tree for the test user. A single root with zero
 * ingredients/directions so the upload tests start on a clean slate.
 * Idempotent: pre-existing rows with the same name are deleted first.
 */
async function setupCoverImageFixture(
	db: PostgresJsDatabase,
	testOwnerId: string
): Promise<{ rootId: string }> {
	const nameList = `(${FIXTURE_NAMES.map((n) => `'${n.replace(/'/g, "''")}'`).join(',')})`;
	await db.execute(
		sql.raw(
			`delete from public.recipe_nodes where owner_id = '${testOwnerId}' and name in ${nameList}`
		)
	);

	const rootId = uuidv4();
	await db.execute(sql`
		insert into public.recipe_nodes (
			id, parent_id, owner_id,
			name, ingredient_changes, direction_changes
		) values (
			${rootId}::uuid,
			null,
			${testOwnerId}::uuid,
			${RECIPE.root},
			'[]'::jsonb,
			'[]'::jsonb
		)
	`);
	return { rootId };
}

test.beforeAll(async () => {
	const client = postgres(DATABASE_URL, { prepare: false });
	const db = drizzle(client);
	try {
		const ids = await setupCoverImageFixture(db, TEST_USER_ID);
		ROOT_ID = ids.rootId;
		console.log(`[e2e recipe-image-url] Created fixture: root=${ROOT_ID}`);
	} finally {
		await client.end();
	}
});

async function openFixture(page: Page) {
	await page.goto('/mise');
	await expect(page.getByRole('heading', { name: 'Recipe List' })).toBeVisible();
	const link = getRecipeLink(page, RECIPE.root);
	await expect(link).toBeVisible();
	await link.click();
	await page.waitForURL(/\/recipes\//);
	await expect(getRecipeHeading(page, RECIPE.root)).toBeVisible();
}

/**
 * Asserts the given `<img>` element has loaded successfully (the
 * browser has rendered it — naturalWidth > 0). A 404 src keeps
 * naturalWidth at 0; a successful signed-URL fetch loads the image.
 */
async function expectImageLoaded(img: import('@playwright/test').Locator, label: string) {
	const naturalWidth = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
	expect(
		naturalWidth,
		`${label} should be loaded (naturalWidth > 0); got ${naturalWidth}`
	).toBeGreaterThan(0);
}

/**
 * Cover image: clicking "Set cover image" opens the file picker, the
 * uploaded image renders without 404, and the render survives a hard
 * reload (so the right URL is server-rendered, not just client-fetched).
 */
test('cover image: upload renders without 404 and survives reload', async ({ page }) => {
	await openFixture(page);

	// Empty state: the empty placeholder is shown.
	await expect(page.getByTestId('recipe-cover-image-empty')).toBeVisible();

	const label = page.getByTestId('upload-cover-label');
	await expect(label).toContainText('Set cover image');

	// The picker fires on click. We dismiss it after the first part of
	// the test and re-click for the actual upload.
	const pickerPromise = page.waitForEvent('filechooser', { timeout: 3000 });
	await label.click();
	const pickerClosed = await pickerPromise;
	// Cancel — we don't want to leak the picker state between tests.
	await pickerClosed.setFiles([]);

	// Click again, attach the file, wait for upload + invalidateAll.
	const [chooser] = await Promise.all([page.waitForEvent('filechooser'), label.click()]);
	await chooser.setFiles({ name: 'final.png', mimeType: 'image/png', buffer: TINY_PNG });

	// After upload completes, the empty placeholder is gone and the
	// image button is rendered.
	await expect(page.getByTestId('recipe-cover-image')).toBeVisible({ timeout: 5000 });
	await expect(page.getByTestId('recipe-cover-image-empty')).toHaveCount(0);

	const img = page.getByTestId('recipe-cover-image').locator('img');
	const src = await img.getAttribute('src');
	expect(src, 'cover image src must include /mise/api/image?path=').toMatch(
		/\/mise\/api\/image\?path=/
	);

	// Direct GET against /mise/api/image with the rendered path must
	// return a 2xx. A 404 here is the failure mode we are guarding against.
	const probe = await page.request.get(src!);
	expect(probe.status(), `/mise/api/image returned ${probe.status()}`).toBeGreaterThanOrEqual(
		200
	);
	expect(probe.status()).toBeLessThan(400);

	await expectImageLoaded(img, 'cover image (initial render)');

	// Hard reload — the rendered URL must come from the server-side
	// initial load, proving the fix isn't a client-only workaround.
	await page.reload();
	await expect(getRecipeHeading(page, RECIPE.root)).toBeVisible();
	const reloaded = page.getByTestId('recipe-cover-image').locator('img');
	await expect(reloaded).toBeVisible();
	const reloadedSrc = await reloaded.getAttribute('src');
	expect(reloadedSrc).toMatch(/\/mise\/api\/image\?path=/);
	await expectImageLoaded(reloaded, 'cover image (after reload)');
});

/**
 * Cover image: the remove affordance clears the column and removes
 * the rendered thumbnail. Covers the "remove cover image" path that
 * shares the file-storage endpoint and tests the symmetry of the
 * URL path on the empty-state placeholder.
 */
test('cover image: Remove clears the rendered image', async ({ page }) => {
	await openFixture(page);

	// Upload first.
	const [chooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.getByTestId('upload-cover-label').click()
	]);
	await chooser.setFiles({ name: 'final.png', mimeType: 'image/png', buffer: TINY_PNG });
	await expect(page.getByTestId('recipe-cover-image')).toBeVisible({ timeout: 5000 });

	// Remove.
	await page.getByTestId('remove-cover-button').click();
	await expect(page.getByTestId('recipe-cover-image')).toHaveCount(0);
	await expect(page.getByTestId('recipe-cover-image-empty')).toBeVisible();
});

/**
 * Ingredient image: edit an ingredient, upload an image on the
 * Images tab, save the row + save the page, then hard-reload and
 * assert the rendered image src uses /mise/api/image and loads.
 *
 * The fixture root is empty so we add an ingredient via the UI
 * (per AGENTS.md: drive UI state through the UI), then edit it to
 * upload an image. Asserts on the storage-backed wire path the same
 * way as the cover-image test — the rendered `<img>` must reach 2xx
 * and load past the broken-image placeholder.
 */
test('ingredient image: upload renders without 404 and survives reload', async ({ page }) => {
	await openFixture(page);

	// Add an ingredient through the UI (no DB shortcuts in the test
	// body — AGENTS.md wants UI-driven state changes).
	await page.getByRole('button', { name: 'Add', exact: true }).first().click();
	await page.getByLabel('Ingredient name').fill('Eggs');
	await page.getByPlaceholder('Amount').fill('2');
	await page
		.locator('form', { has: page.getByLabel('Ingredient name') })
		.getByRole('button', { name: 'Add', exact: true })
		.click();
	await page
		.getByRole('button', { name: 'Save', exact: true })
		.click();
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);

	const row = ingredientRowByName(page, 'Eggs');
	await expect(row).toBeVisible();

	// Open the edit form on the new ingredient and switch to the
	// Images tab.
	await clickRowAction(page, row, 'Edit');
	const form = page.locator('form[data-editing-ingredient]');
	await expect(form).toBeVisible();
	await form.getByTestId('tab-images').click();
	await expect(form.getByTestId('upload-image-label')).toBeVisible();

	// Upload via the picker.
	const [chooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		form.getByTestId('upload-image-label').click()
	]);
	await chooser.setFiles({ name: 'eggs.png', mimeType: 'image/png', buffer: TINY_PNG });

	// Wait for the upload endpoint to round-trip — the new thumb is
	// appended to the local preview.
	await expect(form.getByTestId('edit-images-preview').locator('img')).toHaveCount(1, {
		timeout: 5000
	});

	// Save the row edit (commits the local preview), then save the
	// page-level changes bar.
	await getRowSaveButton(form).click();
	await expect(form).toHaveCount(0);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);

	// Hard reload — re-materialize from server.
	await page.reload();
	await expect(getRecipeHeading(page, RECIPE.root)).toBeVisible();

	const reloadedRow = ingredientRowByName(page, 'Eggs');
	await expect(reloadedRow).toBeVisible();
	const rowImg = reloadedRow.getByTestId('row-image').locator('img');
	await expect(rowImg).toBeVisible();
	const rowSrc = await rowImg.getAttribute('src');
	expect(rowSrc, 'row image src must include /mise/api/image?path=').toMatch(
		/\/mise\/api\/image\?path=/
	);
	const probe = await page.request.get(rowSrc!);
	expect(probe.status()).toBeGreaterThanOrEqual(200);
	expect(probe.status()).toBeLessThan(400);
	await expectImageLoaded(rowImg, 'ingredient row image (after reload)');
});

/**
 * Direction image: same wire path as ingredient — the rendered
 * `<img>` in the row's ImageStrip must use /mise/api/image and load
 * past the broken-image placeholder.
 */
test('direction image: upload renders without 404 and survives reload', async ({ page }) => {
	await openFixture(page);

	// Add a direction through the UI.
	await page.getByRole('button', { name: 'Add', exact: true }).nth(1).click();
	await page.getByLabel('Direction').fill('Preheat oven to 350.');
	await page
		.locator('form', { has: page.getByLabel('Direction') })
		.getByRole('button', { name: 'Add', exact: true })
		.click();
	await page
		.getByRole('button', { name: 'Save', exact: true })
		.click();
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);

	// Open the edit form on the new direction and switch to the
	// Images tab.
	const dirRow = directionRowByIndex(page, 0);
	await expect(dirRow).toBeVisible();
	await clickRowAction(page, dirRow, 'Edit');
	// DirectionRow's edit form is the <form> *inside the row*
	// containing a `data-editing-direction` textarea. Scoping the
	// form by its row lets us ignore the page-level add-direction
	// form (still open with a textarea aria-label="Direction") and
	// any other forms.
	const form = dirRow.locator('form');
	await expect(form).toBeVisible();
	await expect(form.locator('textarea[data-editing-direction]')).toBeVisible();
	await form.getByTestId('tab-images').click();
	await expect(form.getByTestId('upload-image-label')).toBeVisible();

	const [chooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		form.getByTestId('upload-image-label').click()
	]);
	await chooser.setFiles({ name: 'direction.png', mimeType: 'image/png', buffer: TINY_PNG });

	await expect(form.getByTestId('edit-images-preview').locator('img')).toHaveCount(1, {
		timeout: 5000
	});

	await getRowSaveButton(form).click();
	await expect(form).toHaveCount(0);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);

	await page.reload();
	await expect(getRecipeHeading(page, RECIPE.root)).toBeVisible();

	const reloadedDir = directionRowByIndex(page, 0);
	await expect(reloadedDir).toBeVisible();
	const rowImg = reloadedDir.getByTestId('row-image').locator('img');
	await expect(rowImg).toBeVisible();
	const rowSrc = await rowImg.getAttribute('src');
	expect(rowSrc, 'direction row image src must include /mise/api/image?path=').toMatch(
		/\/mise\/api\/image\?path=/
	);
	const probe = await page.request.get(rowSrc!);
	expect(probe.status()).toBeGreaterThanOrEqual(200);
	expect(probe.status()).toBeLessThan(400);
	await expectImageLoaded(rowImg, 'direction row image (after reload)');
});
