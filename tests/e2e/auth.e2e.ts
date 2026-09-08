/**
 * E2E tests for the /auth page — OTP sign-in flow.
 *
 * Tests that require real OTP delivery (Mailpit round-trip) are excluded.
 * The critical UI behaviour — rendering, inflight disabled state — is covered here.
 */
import { expect, test } from '@playwright/test';
import {
	getAuthEmailInput,
	getAuthSendCodeButton,
	getAuthUseDifferentEmailButton
} from './helpers/page-utils';

test('page renders the sign-in form', async ({ page }) => {
	await page.goto('/auth');

	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
	await expect(getAuthEmailInput(page)).toBeVisible();
	await expect(getAuthSendCodeButton(page)).toBeVisible();
});

test('email input and button are disabled while sending code', async ({ page }) => {
	await page.goto('/auth');

	// Intercept and delay the OTP request so inflight state is observable
	await page.route('**/auth?/otpRequest', async (route) => {
		await new Promise((r) => setTimeout(r, 500));
		await route.continue();
	});

	await getAuthEmailInput(page).fill('test@example.com');
	await getAuthSendCodeButton(page).click();

	// Both input and button must be disabled while the request is in-flight
	await expect(getAuthEmailInput(page)).toBeDisabled();
	await expect(getAuthSendCodeButton(page)).toBeDisabled();

	// Wait for the request to finish (button reverts to "Email me a code")
	await expect(getAuthSendCodeButton(page)).toBeVisible({ timeout: 10_000 });
});

test('"Use a different email" is not visible on the request step', async ({ page }) => {
	await page.goto('/auth');

	// "Use a different email" only appears after the verify step
	await expect(getAuthUseDifferentEmailButton(page)).not.toBeVisible();
});
