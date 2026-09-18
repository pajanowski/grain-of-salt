/**
 * E2E regression test for reordering items across an ancestor boundary.
 *
 * Scenario: a recipe is forked (a new node is created with the original
 * as parentId). The fork inherits all visible ingredients and directions
 * from its ancestor. The user can add new items on the fork and reorder
 * its leaf-owned items. The bug being tested: a leaf-added item cannot
 * be moved ABOVE an ancestor-originated item — move-up silently no-ops
 * because the server's apply logic pins the ancestor's position via
 * `Map.set` on an existing key.
 *
 * These two test cases cover the same shape for ingredients and
 * directions; they are independent fixtures (each `test` creates its
 * own recipe fork) and do not share state.
 */
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
	openCreateForm,
	getRecipeNameInput,
	getCreateButton,
	getRecipeLink,
	getRecipeHeading,
	clickRowAction,
	fillAddIngredient,
	fillAddDirection,
	submitAddDirection,
	clickPageSave,
	getIngredientNames,
	getDirectionBodies,
	ingredientRowByName,
	directionRowByIndex,
	forkRecipe
} from './helpers/page-utils';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('move leaf-added ingredient above ancestor ingredient after fork', async ({ page }) => {
	const rootName = uuidv4();

	// Create root recipe and add the first ingredient on it.
	await page.goto('/mise');
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(rootName);
	await getCreateButton(page).click();
	await expect(getRecipeLink(page, rootName)).toBeVisible();
	await getRecipeLink(page, rootName).click();
	await expect(getRecipeHeading(page, rootName)).toBeVisible();

	await fillAddIngredient(page, 'Ing-A', '1', 'cup');
	await expect(getIngredientNames(page)).resolves.toEqual(['Ing-A']);

	// Save so the root node is persisted before forking.
	await clickPageSave(page);

	// Fork from the root. The new recipe's leaf node should display Ing-A
	// (inherited from the parent). The fork page heading is the fork's own
	// name (recipe.name = currentNode.name), not the parent's name.
	const forkedName = await forkRecipe(page, uuidv4);
	await expect(getIngredientNames(page)).resolves.toEqual(['Ing-A']);

	// Add a second ingredient on the fork's leaf.
	await fillAddIngredient(page, 'Ing-B', '2', 'tbsp');
	await expect(getIngredientNames(page)).resolves.toEqual(['Ing-A', 'Ing-B']);

	// Move Ing-B up. Expected: it should swap with the ancestor's Ing-A
	// and the display order should become [Ing-B, Ing-A].
	await clickRowAction(page, ingredientRowByName(page, 'Ing-B'), 'Move up');
	await expect(getIngredientNames(page)).resolves.toEqual(['Ing-B', 'Ing-A']);

	// Save and reload — the new order must survive the round trip.
	await clickPageSave(page);
	await page.reload();
	await expect(getRecipeHeading(page, forkedName)).toBeVisible();
	await expect(getIngredientNames(page)).resolves.toEqual(['Ing-B', 'Ing-A']);
});

test('move leaf-added direction above ancestor direction after fork', async ({ page }) => {
	const rootName = uuidv4();

	// Create root recipe and add the first direction on it.
	await page.goto('/mise');
	await openCreateForm(page);
	await getRecipeNameInput(page).fill(rootName);
	await getCreateButton(page).click();
	await expect(getRecipeLink(page, rootName)).toBeVisible();
	await getRecipeLink(page, rootName).click();
	await expect(getRecipeHeading(page, rootName)).toBeVisible();

	await fillAddDirection(page, 'Step A');
	await submitAddDirection(page);
	await expect(getDirectionBodies(page)).resolves.toEqual(['Step A']);

	// Save so the root node is persisted before forking.
	await clickPageSave(page);

	// Fork from the root. The fork's leaf should display Step A (inherited).
	// The fork page heading is the fork's own name.
	const forkedName = await forkRecipe(page, uuidv4);
	await expect(getDirectionBodies(page)).resolves.toEqual(['Step A']);

	// Add a second direction on the fork's leaf.
	await fillAddDirection(page, 'Step B');
	await submitAddDirection(page);
	await expect(getDirectionBodies(page)).resolves.toEqual(['Step A', 'Step B']);

	// Move Step B up. Expected: it should swap with the ancestor's Step A
	// and the display order should become [Step B, Step A].
	await clickRowAction(page, directionRowByIndex(page, 1), 'Move up');
	await expect(getDirectionBodies(page)).resolves.toEqual(['Step B', 'Step A']);

	// Save and reload — the new order must survive the round trip.
	await clickPageSave(page);
	await page.reload();
	await expect(getRecipeHeading(page, forkedName)).toBeVisible();
	await expect(getDirectionBodies(page)).resolves.toEqual(['Step B', 'Step A']);
});
