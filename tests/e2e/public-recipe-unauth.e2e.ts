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
});
