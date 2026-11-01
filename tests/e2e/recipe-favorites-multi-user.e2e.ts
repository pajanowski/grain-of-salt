/**
 * Single-user E2E tests validating cross-user recipe favoriting against
 * deterministic seeded foreign fixtures.
 *
 * Seed data provisions:
 * - Foreign User: Chef Auguste (SEED_COMMUNITY_USER_ID)
 * - Public recipe: "Auguste's Bouillabaisse" (00000000-0000-0000-0000-000000000101)
 * - Private recipe: "Auguste's Secret Sauce" (00000000-0000-0000-0000-000000000102)
 */
import { expect, test } from '@playwright/test';
import {
	getFavoriteStarButton,
	getFavoriteCard
} from './helpers/page-utils';

const AUGUSTE_PUBLIC_RECIPE_ID = '00000000-0000-0000-0000-000000000101';
const AUGUSTE_PRIVATE_RECIPE_ID = '00000000-0000-0000-0000-000000000102';

test.describe('Cross-user recipe favorites', () => {
	test('user can favorite foreign public recipe, view with author attribution on dashboard, navigate, and unfavorite', async ({
		page
	}) => {
		// 1. Navigate to Auguste's public Bouillabaisse recipe
		await page.goto(`/recipe/${AUGUSTE_PUBLIC_RECIPE_ID}`);
		const starButton = getFavoriteStarButton(page);
		await expect(starButton).toBeVisible();

		// Ensure starting from clean unfavorited state
		const initialLabel = await starButton.getAttribute('aria-label');
		if (initialLabel === 'Unfavorite recipe') {
			await starButton.click();
			await expect(starButton).toHaveAttribute('aria-label', 'Favorite recipe');
		}

		// 2. Favorite Auguste's public recipe
		const favoriteResponse = page.waitForResponse(
			(r) =>
				r.url().includes(`/mise/api/recipe-node/${AUGUSTE_PUBLIC_RECIPE_ID}/favorite`) &&
				r.request().method() === 'PATCH'
		);
		await starButton.click();
		await favoriteResponse;

		await expect(starButton).toHaveAttribute('aria-label', 'Unfavorite recipe');

		// 3. Visit /mise dashboard -> verify recipe card and author badge appear
		await page.goto('/mise');
		await expect(page.getByRole('heading', { name: 'Favorites' })).toBeVisible();

		const favCard = getFavoriteCard(page, "Auguste's Bouillabaisse");
		await expect(favCard).toBeVisible();
		const authorBadge = favCard.getByTestId('recipe-author-badge');
		await expect(authorBadge).toBeVisible();
		await expect(authorBadge).toHaveText(/by Chef Auguste/);

		// 4. Click favorite card -> routes to public recipe viewer
		await favCard.click();
		await expect(page).toHaveURL(`/recipe/${AUGUSTE_PUBLIC_RECIPE_ID}`);

		// 5. Unfavorite from public recipe header
		const publicStarButton = getFavoriteStarButton(page);
		await expect(publicStarButton).toBeVisible();
		const unfavoriteResponse = page.waitForResponse(
			(r) =>
				r.url().includes(`/mise/api/recipe-node/${AUGUSTE_PUBLIC_RECIPE_ID}/favorite`) &&
				r.request().method() === 'PATCH'
		);
		await publicStarButton.click();
		await unfavoriteResponse;

		await expect(publicStarButton).toHaveAttribute('aria-label', 'Favorite recipe');

		// 6. Return to /mise dashboard -> recipe is removed from favorites
		await page.goto('/mise');
		await expect(getFavoriteCard(page, "Auguste's Bouillabaisse")).not.toBeVisible();
	});

	test('attempting to favorite a foreign private recipe returns 403 Forbidden', async ({
		page
	}) => {
		const response = await page.request.patch(
			`/mise/api/recipe-node/${AUGUSTE_PRIVATE_RECIPE_ID}/favorite`
		);
		expect(response.status()).toBe(403);
	});

	test('unauthenticated visitor clicking favorite star is redirected to sign-in', async ({
		browser
	}) => {
		const guestContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		const guestPage = await guestContext.newPage();

		await guestPage.goto(`/recipe/${AUGUSTE_PUBLIC_RECIPE_ID}`);
		const guestStar = getFavoriteStarButton(guestPage);
		await expect(guestStar).toBeVisible();
		await guestStar.click();

		await expect(guestPage).toHaveURL(
			new RegExp(`/auth\\?next=${encodeURIComponent(`/recipe/${AUGUSTE_PUBLIC_RECIPE_ID}`)}`)
		);

		await guestContext.close();
	});
});
