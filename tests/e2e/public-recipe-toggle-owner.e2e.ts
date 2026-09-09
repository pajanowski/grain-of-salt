/**
 * E2E tests that the PATCH /mise/api/recipe-node/[nodeId]/public endpoint
 * correctly rejects unauthenticated callers (401) and non-owners (403).
 */
import { expect, test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import postgres from 'postgres';

const db = postgres('postgres://postgres:postgres@127.0.0.1:54322/postgres');

async function createRecipeNode(name: string, ownerId: string): Promise<{ nodeId: string }> {
	const row = await db`
		insert into recipe_nodes (id, name, owner_id, ingredient_changes, direction_changes)
		values (gen_random_uuid(), ${name}, ${ownerId}::uuid, '[]'::jsonb, '[]'::jsonb)
		returning id
	`;
	return { nodeId: row[0].id };
}

test.describe('PATCH /mise/api/recipe-node/[nodeId]/public — authorization', () => {
	test('returns 401 when unauthenticated', async () => {
		const recipeName = uuidv4();
		const { nodeId } = await createRecipeNode(recipeName, '11111111-1111-1111-1111-111111111111');

		// Use Node's native fetch with an absolute URL — no browser cookies,
		// no Playwright request fixture storageState inheritance.
		const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
		const response = await fetch(`${baseURL}/mise/api/recipe-node/${nodeId}/public`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ isPublic: true })
		});

		expect(response.status).toBe(401);
	});

	test('returns 403 when the caller is not the owner', async ({ page }) => {
		// Create a recipe owned by the demo user.
		const recipeName = uuidv4();
		const { nodeId } = await createRecipeNode(recipeName, '00000000-0000-0000-0000-000000000001');

		// Browser is signed in as test user (via storageState), NOT demo user.
		// page.request.fetch sends cookies from the browser context, so this
		// request carries the test user's auth but targets a demo-owned node.
		const response = await page.request.fetch(
			`/mise/api/recipe-node/${nodeId}/public`,
			{
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ isPublic: true })
			}
		);

		// 403 because test_user != node owner (demo_user).
		expect(response.status()).toBe(403);
	});

	test('owner can toggle is_public true and back to false', async ({ page }) => {
		const recipeName = uuidv4();
		const { nodeId } = await createRecipeNode(recipeName, '11111111-1111-1111-1111-111111111111');

		// Browser is signed in as test user (the owner).
		await page.goto(`/mise/recipes/${nodeId}`);

		// Open menu and make public. The click handler is async but not awaited,
		// so race the DB query by waiting for the PATCH response first.
		const publicResponse = page.waitForResponse(
			(r) => r.url().includes(`/mise/api/recipe-node/${nodeId}/public`) && r.status() === 200
		);
		await page.getByRole('button', { name: 'Recipe actions' }).click();
		await page.getByRole('menuitem', { name: 'Make public' }).click();
		await publicResponse;

		// Verify it's now public in the DB.
		const pubRow = await db`select is_public from recipe_nodes where id = ${nodeId}::uuid`;
		expect(pubRow[0].is_public).toBe(true);

		// Toggle back to private.
		const privateResponse = page.waitForResponse(
			(r) => r.url().includes(`/mise/api/recipe-node/${nodeId}/public`) && r.status() === 200
		);
		await page.getByRole('button', { name: 'Recipe actions' }).click();
		await page.getByRole('menuitem', { name: 'Make private' }).click();
		await privateResponse;
	});
});
