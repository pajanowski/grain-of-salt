/**
 * E2E tests for the public recipe page accessed without authentication.
 *
 * The chromium-noauth project starts with no auth cookies, so tests begin
 * in a signed-out state automatically. No sign-out navigation is needed.
 */
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import postgres from 'postgres';
import {
	getRecipeHeading,
	getMiseSidebar,
	getAddButton,
	getUnsavedChangesBar,
	getSignInToForkCTA,
	openCreateForm,
	getRecipeNameInput,
	getCreateButton,
	getRecipeLink,
	getRecipeActionsButton,
	getRecipeActionsMenuItem,
	getIngredientNames,
	getDirectionBodies,
} from './helpers/page-utils';

const db = postgres('postgres://postgres:postgres@127.0.0.1:54322/postgres');

/**
 * Create a root recipe node directly in the DB and return its id.
 * Uses the test user's owner id so the auth-gated /mise page can load it.
 */
async function createRecipeNode(name: string, ownerId: string): Promise<{ nodeId: string }> {
	const row = await db`
		insert into recipe_nodes (id, name, owner_id, ingredient_changes, direction_changes)
		values (gen_random_uuid(), ${name}, ${ownerId}::uuid, '[]'::jsonb, '[]'::jsonb)
		returning id
	`;
	return { nodeId: row[0].id };
}

test.describe('public recipe — unauthenticated', () => {
	test('public node is reachable without auth and renders read-only', async ({ page }) => {
		// Browser starts unauthenticated (chromium-noauth project).

		// Create a recipe under the test user and mark it public in the DB.
		const recipeName = uuidv4();
		const { nodeId } = await createRecipeNode(recipeName, '11111111-1111-1111-1111-111111111111');
		await db`update recipe_nodes set is_public = true where id = ${nodeId}::uuid`;

		// Visit the public page (no auth required).
		await page.goto(`/recipe/${nodeId}`);

		// Should render the recipe name.
		await expect(getRecipeHeading(page, recipeName)).toBeVisible();

		// Should NOT have the mise sidebar.
		await expect(getMiseSidebar(page)).not.toBeVisible();

		// Should NOT have an Add button.
		await expect(getAddButton(page)).not.toBeVisible();

		// Should NOT have the unsaved-changes bar.
		await expect(getUnsavedChangesBar(page)).not.toBeVisible();

		// Should show the sign-in CTA for forks.
		await expect(getSignInToForkCTA(page)).toBeVisible();
	});

	test('private node returns 404 to unauthenticated viewer', async ({ page }) => {
		// Browser starts unauthenticated.

		// Create a private recipe (is_public is false by default).
		const recipeName = uuidv4();
		const { nodeId } = await createRecipeNode(recipeName, '11111111-1111-1111-1111-111111111111');

		// Attempt to visit the public page — should 404.
		const response = await page.goto(`/recipe/${nodeId}`);
		expect(response?.status()).toBe(404);
	});

	test('public leaf of a private root renders the compiled recipe, not just the leaf changes', async ({
		page
	}) => {
		// Bug: when the user makes a *descendant* node public but its ancestors
		// are still private, the public page used to render only the leaf's
		// own changes. The user-visible behavior should be the fully-compiled
		// recipe — i.e. ingredients/directions added by ancestors must still
		// appear, even though the ancestors themselves remain private.

		// 1. Create a private root with one ingredient and one direction.
		//    postgres.js template literals serialize JS arrays to jsonb
		//    natively — do NOT wrap with JSON.stringify(...) (that yields a
		//    jsonb *string scalar*, which applyNodes silently skips).
		const rootIngredientId = uuidv4();
		const rootDirectionId = uuidv4();
		const rootName = uuidv4();
		const rootIngredientChanges = [
			{
				id: uuidv4(),
				changeType: 'add',
				targetId: null,
				note: null,
				body: {
					id: rootIngredientId,
					name: 'root-ingredient',
					amount: 1,
					unit: 'cup'
				}
			}
		];
		const rootDirectionChanges = [
			{
				id: uuidv4(),
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: rootDirectionId, body: 'root-step' }
			}
		];
		const rootRow = await db`
			insert into recipe_nodes (
				id, name, owner_id, parent_id,
				ingredient_changes, direction_changes, is_public
			)
			values (
				gen_random_uuid(), ${rootName},
				'11111111-1111-1111-1111-111111111111'::uuid, null,
				${rootIngredientChanges as unknown as string},
				${rootDirectionChanges as unknown as string},
				false
			)
			returning id
		`;
		const rootId = rootRow[0].id;

		// 2. Fork it: child adds its own ingredient + direction and is public.
		const leafName = uuidv4();
		const leafIngredientId = uuidv4();
		const leafDirectionId = uuidv4();
		const leafIngredientChanges = [
			{
				id: uuidv4(),
				changeType: 'add',
				targetId: null,
				note: null,
				body: {
					id: leafIngredientId,
					name: 'leaf-ingredient',
					amount: 2,
					unit: 'tbsp'
				}
			}
		];
		const leafDirectionChanges = [
			{
				id: uuidv4(),
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: leafDirectionId, body: 'leaf-step' }
			}
		];
		const leafRow = await db`
			insert into recipe_nodes (
				id, name, owner_id, parent_id,
				ingredient_changes, direction_changes, is_public
			)
			values (
				gen_random_uuid(), ${leafName},
				'11111111-1111-1111-1111-111111111111'::uuid, ${rootId}::uuid,
				${leafIngredientChanges as unknown as string},
				${leafDirectionChanges as unknown as string},
				true
			)
			returning id
		`;
		const leafId = leafRow[0].id;

		// 3. Visit the public leaf as an unauthenticated viewer.
		await page.goto(`/recipe/${leafId}`);

		// 4. The page should render the COMPILED recipe: both the ancestor's
		//    ingredient/direction AND the leaf's additions. (Before the fix,
		//    the ancestor's row was missing — only the leaf's diff rendered.)
		await expect(getRecipeHeading(page, leafName)).toBeVisible();

		const ingredientNames = await getIngredientNames(page);
		expect(ingredientNames).toContain('root-ingredient');
		expect(ingredientNames).toContain('leaf-ingredient');

		const directionBodies = await getDirectionBodies(page);
		expect(directionBodies).toContain('root-step');
		expect(directionBodies).toContain('leaf-step');
	});
});
