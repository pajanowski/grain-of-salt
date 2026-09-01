/**
 * Test-user auth helpers. Supabase local stack ships Inbucket v3 (not
 * Mailpit) at http://127.0.0.1:54324.
 *
 * REST API:
 *   GET /api/v1/mailbox/{name}        — list messages in a mailbox
 *   GET /api/v1/mailbox/{name}/{id}   — message body
 *
 * Inbucket indexes mailboxes by the local-part of the address.
 *
 * Performance note: tests using `signInAsTestUser(page)` in beforeEach
 * pay ~3s per test. For long suites, prefer using a worker-cached
 * `storageState` via global-setup (exported to a file consumed by
 * playwright.config projects[].use.storageState).
 */
import { expect, type Page } from '@playwright/test';
import { TEST_USER_EMAIL } from './auth-shared';

const INBUCKET_BASE = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

interface InbucketMessage {
	mailbox: string;
	id: string;
	from: string;
	to: string[];
	subject: string;
	date: string;
}

interface InbucketMessageDetail {
	mailbox: string;
	id: string;
	from: string;
	to: string[];
	subject: string;
	date: string;
	body: { html?: string; text?: string };
}

async function fetchLatestCodeFor(toEmail: string): Promise<string> {
	const localPart = toEmail.split('@')[0];
	const mailbox = encodeURIComponent(localPart);

	const list = await fetch(`${INBUCKET_BASE}/api/v1/mailbox/${mailbox}`);
	if (!list.ok) {
		throw new Error(`Inbucket mailbox ${localPart} fetch failed: ${list.status}`);
	}
	const messages = (await list.json()) as InbucketMessage[];
	if (messages.length === 0) {
		throw new Error(`No Inbucket messages in mailbox ${localPart}`);
	}

	const latest = messages[messages.length - 1];

	const detail = await fetch(
		`${INBUCKET_BASE}/api/v1/mailbox/${mailbox}/${encodeURIComponent(latest.id)}`
	);
	if (!detail.ok) {
		throw new Error(`Inbucket detail failed: ${detail.status}`);
	}
	const msg = (await detail.json()) as InbucketMessageDetail;

	const haystack = `${msg.body.html ?? ''}\n${msg.body.text ?? ''}`;
	const match = haystack.match(/\b(\d{8})\b/);
	if (!match) {
		throw new Error(`Could not find 8-digit code in Inbucket message ${latest.id}`);
	}
	return match[1];
}

async function pollForOtp(toEmail: string, timeoutMs = 15_000): Promise<string> {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;
	while (Date.now() < deadline) {
		try {
			return await fetchLatestCodeFor(toEmail);
		} catch (e) {
			lastError = e;
			await new Promise((r) => setTimeout(r, 250));
		}
	}
	throw new Error(`Failed to retrieve OTP from Inbucket: ${String(lastError)}`);
}

/**
 * Sign a single page in via the OTP form. ~3s per call. The browser
 * context is left signed in (Supabase auth cookies set).
 */
export async function signInAsTestUser(page: Page) {
	await page.goto('/auth');

	await page.getByLabel('Email').fill(TEST_USER_EMAIL);
	await page.getByRole('button', { name: /email me a code/i }).click();

	await expect(page.getByLabel(/8-digit code/i)).toBeVisible({ timeout: 10_000 });

	const code = await pollForOtp(TEST_USER_EMAIL);

	await page.getByLabel(/8-digit code/i).fill(code);
	await page.getByRole('button', { name: /^Verify$/i }).click();

	await expect(page).not.toHaveURL(/\/auth/, { timeout: 10_000 });
}
