/**
 * Shared page-level locators and small helpers used across e2e tests.
 *
 * Anything here must be reusable — keep file-specific form behaviour in
 * its own test file. Generality is the price of being shared.
 */
import { expect, type Locator, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Inline create-recipe form (home page)
// ---------------------------------------------------------------------------

/** Open the inline create-recipe form on the home page and assert the
 * name input is visible. Every create-recipe test starts with this step.
 */
export async function openCreateForm(page: Page) {
	await page.getByRole('button', { name: 'Create Recipe' }).click();
	await expect(page.getByPlaceholder('Recipe name')).toBeVisible();
}

/** The create-recipe form's name input (located by placeholder). */
export function getRecipeNameInput(page: Page) {
	return page.getByPlaceholder('Recipe name');
}

/** The submit button on the create-recipe form (exact "Create"). */
export function getCreateButton(page: Page) {
	return page.getByRole('button', { name: 'Create', exact: true });
}

/** The cancel button on the create-recipe form. */
export function getCancelButton(page: Page) {
	return page.getByRole('button', { name: 'Cancel' });
}

// ---------------------------------------------------------------------------
// Recipe links and headings (recipe list + detail page)
// ---------------------------------------------------------------------------

/** A recipe link in the recipe tree, matched by exact accessible name. */
export function getRecipeLink(page: Page, name: string) {
	return page.getByRole('link', { name, exact: true });
}

/** The "Recipe: <name>" heading on the recipe detail page. */
export function getRecipeHeading(page: Page, name: string) {
	return page.getByRole('heading', { name: `${name}` });
}

// ---------------------------------------------------------------------------
// Add-row forms (recipe detail page — ingredients and directions)
// ---------------------------------------------------------------------------

/**
 * The "Add" submit button inside an add-row form. Takes any locator so
 * the same getter works page-scoped (form filter) and form-scoped (after
 * fill).
 */
export function getAddButton(scope: Page | Locator) {
	return scope.getByRole('button', { name: 'Add', exact: true });
}

// ---------------------------------------------------------------------------
// Per-row actions (ingredient / direction rows)
// ---------------------------------------------------------------------------

/** Per-row actions menu trigger (aria-label starts with "Actions for"). */
export function getRowActionsButton(row: Locator) {
	return row.getByRole('button', { name: /^Actions for/ });
}

/**
 * The "Add" trigger button in the Ingredients section header. Resolved
 * by walking up from the "Ingredients" heading to its flex container and
 * locating the descendant Add button — this disambiguates from the
 * Directions section's identical "Add" button.
 */
export function getAddIngredientButton(page: Page) {
	return page
		.getByText('Ingredients')
		.locator('..')
		.getByRole('button', { name: 'Add', exact: true });
}

/**
 * The "Add" trigger button in the Directions section header. See
 * getAddIngredientButton for the resolution strategy.
 */
export function getAddDirectionButton(page: Page) {
	return page
		.getByText('Directions')
		.locator('..')
		.getByRole('button', { name: 'Add', exact: true });
}

// ---------------------------------------------------------------------------
// Inline add-row form inputs (recipe detail page)
// ---------------------------------------------------------------------------

/**
 * The "Ingredient name" input inside the inline add-ingredient form.
 * Located by accessible name (aria-label on the input).
 */
export function getIngredientNameInput(page: Page) {
	return page.getByRole('textbox', { name: 'Ingredient name' });
}

/**
 * The "Unit" text input inside the inline add-ingredient form.
 * Located by placeholder (the Autocomplete component renders a plain input
 * with placeholder="Unit" for the add form).
 */
export function getAddIngredientUnitInput(page: Page) {
	return page.getByPlaceholder('Unit');
}

/**
 * The currently-open add-ingredient form (has "Ingredient name" input).
 */
function openIngredientForm(page: Page) {
	return page
		.locator('form')
		.filter({ has: page.getByRole('textbox', { name: 'Ingredient name' }) })
		.first();
}

/**
 * Fill the inline add-ingredient form and submit it. The form stays open
 * after a successful Add so callers can chain multiple ingredients.
 */
export async function fillAddIngredient(page: Page, name: string, amount: string, unit: string) {
	let form = openIngredientForm(page);
	if ((await form.count()) === 0) {
		await getAddIngredientButton(page).click();
		form = openIngredientForm(page);
	}
	await expect(getIngredientNameInput(page)).toBeVisible();
	await getIngredientNameInput(page).fill(name);
	await page.getByPlaceholder('Amount').fill(amount);
	await getAddIngredientUnitInput(page).fill(unit);
	await getAddButton(form).click();
}

/**
 * Create a recipe, navigate to it, and add one ingredient.
 * Returns the recipe name used.
 */
export async function createRecipeWithIngredient(
	page: Page,
	name: string,
	ingredientName: string,
	amount: string,
	unit: string
): Promise<string> {
	await page.goto('/mise');
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(name);
	await getCreateButton(page).click();
	await expect(getRecipeLink(page, name)).toBeVisible();
	await getRecipeLink(page, name).click();
	await expect(page.getByRole('heading', { name })).toBeVisible();
	await fillAddIngredient(page, ingredientName, amount, unit);
	return name;
}

/**
 * The "Direction" textarea inside the inline add-direction form.
 * Located by accessible name (aria-label on the textarea).
 */
export function getDirectionBodyInput(page: Page) {
	return page.getByRole('textbox', { name: 'Direction' });
}

/** Per-row Save button (Edit-mode submit). */
export function getRowSaveButton(row: Locator) {
	return row.getByRole('button', { name: 'Save', exact: true });
}

/**
 * Open a row's actions menu and click the given action. Same body for
 * ingredient and direction rows — only the row locator differs.
 */
export async function clickRowAction(
	page: Page,
	row: Locator,
	action: 'Edit' | 'Substitute' | 'Move up' | 'Move down' | 'Remove'
) {
	await getRowActionsButton(row).click();
	await page.getByRole('menuitem', { name: action }).click();
}
/** "Email me a code" or "Sending…" button on the auth page request step. */
export function getAuthSendCodeButton(page: Page) {
	return page.getByRole('button', { name: /Email me a code|Sending/ });
}

/** "Verify" or "Verifying…" button on the auth page verify step. */
export function getAuthVerifyButton(page: Page) {
	return page.getByRole('button', { name: /Verify/ });
}

/** 8-digit OTP code input on the auth page verify step. */
export function getAuthCodeInput(page: Page) {
	return page.getByLabel(/8-digit code/i);
}

/** "Use a different email" button on the auth page verify step. */
export function getAuthUseDifferentEmailButton(page: Page) {
	return page.getByRole('button', { name: 'Use a different email' });
}

/** Email input on the auth page request step. */
export function getAuthEmailInput(page: Page) {
	return page.getByLabel('Email');
}

// ---------------------------------------------------------------------------
// Recipe actions menu (recipe detail page)
// ---------------------------------------------------------------------------

/** "Recipe actions" menu trigger button on the recipe detail page. */
export function getRecipeActionsButton(page: Page) {
	return page.getByRole('button', { name: 'Recipe actions' });
}

/** A menuitem inside the recipe actions menu. */
export function getRecipeActionsMenuItem(page: Page, label: string) {
	return page.getByRole('menuitem', { name: label });
}

/**
 * Fork the currently-displayed recipe. Returns the new fork's name
 * (rewritten to a fresh uuid so the fixture doesn't collide with anything
 * in the recipe tree). On return the page is the fork's
 * `/mise/recipes/<forkNodeId>` view.
 */
export async function forkRecipe(page: Page, uuid: () => string): Promise<string> {
	await getRecipeActionsButton(page).click();
	await getRecipeActionsMenuItem(page, 'Fork recipe').click();
	const forkedName = uuid();
	await page.getByLabel('Forked recipe name').fill(forkedName);
	await page.getByRole('button', { name: 'Fork', exact: true }).click();
	await getRecipeHeading(page, forkedName).waitFor();
	return forkedName;
}

// ---------------------------------------------------------------------------
// Share / copy (public recipe page)
// ---------------------------------------------------------------------------

/** "Copy" button on the public recipe share bar. */
export function getShareCopyButton(page: Page) {
	return page.getByRole('button', { name: 'Copy' });
}

/** "Copied!" state of the share copy button. */
export function getCopiedButton(page: Page) {
	return page.getByRole('button', { name: 'Copied!' });
}

/** Share link for a public recipe (href=/recipe/{nodeId}). */
export function getPublicRecipeShareLink(page: Page, nodeId: string) {
	return page.locator(`a[href="/recipe/${nodeId}"]`);
}

// ---------------------------------------------------------------------------
// Recipe graph page
// ---------------------------------------------------------------------------

/** The SvelteFlow canvas root element (.svelte-flow). */
export function getSvelteFlowCanvas(page: Page) {
	return page.locator('.svelte-flow');
}

/** All SvelteFlow nodes (.svelte-flow__node). */
export function getSvelteFlowNodes(page: Page) {
	return page.locator('.svelte-flow__node');
}

/** "← Back to recipe" link on the graph page. */
export function getBackToRecipeLink(page: Page) {
	return page.getByRole('link', { name: '← Back to recipe' });
}

// ---------------------------------------------------------------------------
// Public recipe page (unauthenticated)
// ---------------------------------------------------------------------------

/** The mise sidebar aside element (absent on the public page). */
export function getMiseSidebar(page: Page) {
	return page.locator('aside');
}

/** Unsaved changes bar on the recipe detail page. */
export function getUnsavedChangesBar(page: Page) {
	return page.getByText('Unsaved changes');
}

/** "Sign in to fork" CTA on the public recipe page. */
export function getSignInToForkCTA(page: Page) {
	return page.getByText('Sign in to fork');
}

// ---------------------------------------------------------------------------
// Per-node changes sidebar (NodeChanges)
// ---------------------------------------------------------------------------

/**
 * The sidebar showing each node's individual `ingredientChanges` /
 * `directionChanges` (rendered by `NodeChanges.svelte`). Has a
 * `data-testid="node-changes"` attribute.
 */
export function getNodeChangesPanel(page: Page) {
	return page.getByTestId('node-changes');
}

/**
 * Read the "{N} changes" count text from the NodeChanges header. Returns
 * the parsed integer (0 if not found or unparsable).
 */
export async function getNodeChangesCount(page: Page): Promise<number> {
	const text = await getNodeChangesPanel(page).locator('header > span').first().textContent();
	const match = text?.match(/(\d+)\s*change/);
	return match ? parseInt(match[1], 10) : 0;
}

// ---------------------------------------------------------------------------
// Direction ingredient picker (the "#name" autocomplete in direction textareas)
// ---------------------------------------------------------------------------

/**
 * The ingredient picker listbox that appears when a `#token` is typed in a
 * direction textarea. Rendered by IngredientPicker.svelte with
 * `role="listbox"` and `data-testid="ingredient-picker-listbox"`.
 */
export function getIngredientPicker(page: Page) {
	return page.getByTestId('ingredient-picker-listbox');
}

/**
 * Wait for the ingredient picker to open, then click the option whose label
 * starts with `name` (e.g. "Sugar (1 cup)"). The caller is responsible for
 * typing the `#name` prefix into the direction textarea first — this helper
 * only handles the picker interaction.
 */
export async function pickIngredientFromDirection(page: Page, name: string) {
	const picker = getIngredientPicker(page);
	await expect(picker).toBeVisible({ timeout: 3000 });
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	await picker
		.getByRole('option', { name: new RegExp(`^${escaped}`) })
		.first()
		.click();
}

// ---------------------------------------------------------------------------
// Direction list (recipe detail page)
// ---------------------------------------------------------------------------

/**
 * The `<ol data-testid="direction-list">` element on the recipe detail and
 * public-recipe pages.
 */
export function getDirectionList(page: Page) {
	return page.getByTestId('direction-list');
}

/**
 * A single direction row by its zero-based index. Matches
 * `li[data-direction-index="<index>"]` inside the direction list.
 */
export function getDirectionRow(page: Page, index: number) {
	return getDirectionList(page).locator(`li[data-direction-index="${index}"]`);
}

// ---------------------------------------------------------------------------
// Add-direction form (recipe detail page)
// ---------------------------------------------------------------------------

/**
 * The currently-open add-direction form (has a "Direction" textarea).
 * Mirrors `openIngredientForm` for the add-ingredient form.
 */
function openDirectionForm(page: Page) {
	return page
		.locator('form')
		.filter({ has: page.getByRole('textbox', { name: 'Direction' }) })
		.first();
}

/**
 * Open the inline add-direction form and assert its body textarea is
 * visible. Mirrors the open-form step `fillAddIngredient` performs for
 * the add-ingredient form.
 */
export async function openAddDirectionForm(page: Page) {
	if ((await openDirectionForm(page).count()) === 0) {
		await getAddDirectionButton(page).click();
	}
	await expect(getDirectionBodyInput(page)).toBeVisible();
}

/**
 * Open the add-direction form and fill its body textarea.
 */
export async function fillAddDirection(page: Page, body: string) {
	await openAddDirectionForm(page);
	await getDirectionBodyInput(page).fill(body);
}

/**
 * Open the add-direction form, type `prefix` char-by-char so the ingredient
 * picker can detect the trailing `#name` token, pick the ingredient whose
 * label starts with `ingredientName`, then continue typing `suffix` (if any).
 *
 * The picker closes as soon as a whitespace character is typed after the
 * `#name`, so the text must be split around the picker interaction — that's
 * what this helper enforces. We restore the textarea caret to the end of the
 * inserted `#uuid` after the picker click, since the picker option steals
 * focus and Playwright's `pressSequentially` would otherwise start typing
 * from caret position 0.
 */
export async function fillAddDirectionWithIngredient(
	page: Page,
	prefix: string,
	ingredientName: string,
	suffix = ''
) {
	await openAddDirectionForm(page);
	const ta = getDirectionBodyInput(page);
	await ta.click();
	await ta.pressSequentially(prefix, { delay: 10 });
	await pickIngredientFromDirection(page, ingredientName);
	if (suffix.length > 0) {
		// Focus the textarea (the picker click moved focus to the option button)
		// and place the caret at the end so the suffix appends after `#uuid`.
		await ta.focus();
		await ta.evaluate((el) => {
			const t = el as HTMLTextAreaElement;
			t.selectionStart = t.selectionEnd = t.value.length;
		});
		await ta.pressSequentially(suffix, { delay: 10 });
	}
}

/**
 * Click "Add" inside the currently-open add-direction form.
 */
export async function submitAddDirection(page: Page) {
	await getAddButton(openDirectionForm(page)).click();
}

/**
 * Find a chip inside the direction textarea's overlay. The overlay sits
 * as a sibling of the textarea inside the same parent, so this walks up
 * from the "Direction" textbox and locates the given text. Useful for
 * asserting chip visibility while the editing form is focused/blurred.
 */
export function getChipInTextBox(page: Page, text: string | RegExp) {
	return getDirectionBodyInput(page).locator('..').getByText(text);
}

// ---------------------------------------------------------------------------
// Edit-direction form (per row)
// ---------------------------------------------------------------------------

/**
 * Click the Edit action on the given direction row and assert the editing
 * textarea is visible.
 */
export async function openEditDirectionForm(page: Page, row: Locator) {
	await clickRowAction(page, row, 'Edit');
	await expect(page.locator('textarea[data-editing-direction]')).toBeVisible();
}

/**
 * Click the Save button on the currently-open edit-direction form.
 */
export async function submitEditDirection(page: Page) {
	// The editing form is the closest <form> containing the editing-direction
	// textarea; locate the Save button inside that form (the direct parent of
	// the textarea is a layout div that doesn't include Save/Cancel).
	await page
		.locator('form', { has: page.locator('textarea[data-editing-direction]') })
		.getByRole('button', { name: 'Save', exact: true })
		.first()
		.click();
}

// ---------------------------------------------------------------------------
// Page-level Save (unsaved changes bar on the recipe detail page)
// ---------------------------------------------------------------------------

/**
 * Click the page-level Save button in the unsaved-changes bar and wait
 * for the bar (and button) to disappear. Only valid when the bar is
 * visible — i.e. there are pending changes. Pairs with
 * `getUnsavedChangesBar`.
 */
export async function clickPageSave(page: Page) {
	const save = page.getByRole('button', { name: 'Save', exact: true });
	await expect(save).toBeEnabled();
	await save.click();
	await expect(save).toHaveCount(0);
}

// ---------------------------------------------------------------------------
// Snapshot helpers (used by reorder tests)
// ---------------------------------------------------------------------------

/**
 * Snapshot the visible ingredient names in display order, from
 * `data-ingredient-name` on each <li>.
 */
export async function getIngredientNames(page: Page): Promise<string[]> {
	return page
		.getByTestId('ingredient-list')
		.locator('li[data-ingredient-name]')
		.evaluateAll((els) => els.map((el) => el.getAttribute('data-ingredient-name')!));
}

/**
 * Snapshot the visible direction bodies in display order, by stripping
 * the leading "N. " that the template prepends.
 */
export async function getDirectionBodies(page: Page): Promise<string[]> {
	return page
		.getByTestId('direction-list')
		.locator('li[data-direction-index]')
		.evaluateAll((els) =>
			els.map((el) => {
				const span = el.querySelector('span.flex-1');
				return span?.textContent?.replace(/^\d+\.\s*/, '').trim() ?? '';
			})
		);
}

/**
 * An ingredient row locator by name, scoped to the ingredient list.
 * Pairs with `getIngredientNames`.
 */
export function ingredientRowByName(page: Page, name: string) {
	return page.getByTestId('ingredient-list').locator(`li[data-ingredient-name="${name}"]`);
}

/**
 * A direction row locator by its zero-based index. Pairs with
 * `getDirectionBodies` (which yields bodies in the same index order).
 */
export function directionRowByIndex(page: Page, index: number) {
	return page.getByTestId('direction-list').locator(`li[data-direction-index="${index}"]`);
}
