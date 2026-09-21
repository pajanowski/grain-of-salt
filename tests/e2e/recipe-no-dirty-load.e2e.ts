/**
 * Diagnostic: load the seeded demo recipes (which have known change
 * patterns from scripts/seed.ts) and check for the unsaved bar.
 *
 * - Simple Omelette: 3 ingredient adds + 4 direction adds, NO edits
 * - French Omelette: parent=Simple, has 1 ingredient edit + 1 add + 3 direction edits
 * - Cheese Omelette: parent=Simple, has 1 ingredient add + 1 direction edit
 * - Denver Omelette: parent=Simple, has 2 ingredient adds + 1 direction add
 *
 * These clones are created by the global-setup and assigned to TEST_USER_ID.
 */
import { expect, test } from '@playwright/test';
import { getRecipeLink, getRecipeHeading, getUnsavedChangesBar } from './helpers/page-utils';

async function snapshot(page: any, label: string) {
	const barVisible = await getUnsavedChangesBar(page).isVisible().catch(() => false);
	const unsavedBadges = await page.locator('[data-status="unsaved"]').count();
	const allStatuses = await page
		.locator('[data-status]')
		.evaluateAll((els: any[]) => els.map((e) => e.getAttribute('data-status')))
		.catch(() => []);
	console.log(`[${label}] bar=${barVisible} badges=${unsavedBadges} statuses=${JSON.stringify(allStatuses)}`);
	return { barVisible, unsavedBadges, allStatuses };
}

const SEEDED = ['Simple Omelette', 'French Omelette', 'Cheese Omelette', 'Denver Omelette'] as const;

test('diagnose: each seeded recipe — fresh load', async ({ page }) => {
	for (const name of SEEDED) {
		await page.goto('/mise');
		await getRecipeLink(page, name).click();
		await expect(getRecipeHeading(page, name)).toBeVisible();
		await snapshot(page, name);
	}
});

// The actual assertion
test('hard assertion: no unsaved bar on any seeded recipe', async ({ page }) => {
	for (const name of SEEDED) {
		await page.goto('/mise');
		await getRecipeLink(page, name).click();
		await expect(getRecipeHeading(page, name)).toBeVisible();
		const bar = getUnsavedChangesBar(page);
		await expect(bar).toBeHidden();
		await expect(page.locator('[data-status="unsaved"]')).toHaveCount(0);
	}
});
