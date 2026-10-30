import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime } from './formatDate';

describe('formatRelativeTime', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns empty string for null, undefined, or invalid dates', () => {
		expect(formatRelativeTime(null)).toBe('');
		expect(formatRelativeTime(undefined)).toBe('');
		expect(formatRelativeTime('invalid-date')).toBe('');
	});

	it('formats seconds as "just now"', () => {
		const now = new Date('2026-10-30T12:00:00Z');
		const thirtySecsAgo = new Date(now.getTime() - 30 * 1000);
		expect(formatRelativeTime(thirtySecsAgo)).toBe('just now');
	});

	it('formats minutes ago', () => {
		const now = new Date('2026-10-30T12:00:00Z');
		const oneMinAgo = new Date(now.getTime() - 60 * 1000);
		const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
		expect(formatRelativeTime(oneMinAgo)).toBe('1 minute ago');
		expect(formatRelativeTime(fiveMinAgo)).toBe('5 minutes ago');
	});

	it('formats hours ago', () => {
		const now = new Date('2026-10-30T12:00:00Z');
		const oneHourAgo = new Date(now.getTime() - 3600 * 1000);
		const threeHoursAgo = new Date(now.getTime() - 3 * 3600 * 1000);
		expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');
		expect(formatRelativeTime(threeHoursAgo)).toBe('3 hours ago');
	});

	it('formats days ago', () => {
		const now = new Date('2026-10-30T12:00:00Z');
		const oneDayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
		const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 3600 * 1000);
		expect(formatRelativeTime(oneDayAgo)).toBe('1 day ago');
		expect(formatRelativeTime(fiveDaysAgo)).toBe('5 days ago');
	});

	it('formats months ago', () => {
		const now = new Date('2026-10-30T12:00:00Z');
		const oneMonthAgo = new Date(now.getTime() - 35 * 24 * 3600 * 1000);
		const twoMonthsAgo = new Date(now.getTime() - 65 * 24 * 3600 * 1000);
		expect(formatRelativeTime(oneMonthAgo)).toBe('1 month ago');
		expect(formatRelativeTime(twoMonthsAgo)).toBe('2 months ago');
	});

	it('formats years ago', () => {
		const now = new Date('2026-10-30T12:00:00Z');
		const oneYearAgo = new Date(now.getTime() - 400 * 24 * 3600 * 1000);
		expect(formatRelativeTime(oneYearAgo)).toBe('1 year ago');
	});
});
