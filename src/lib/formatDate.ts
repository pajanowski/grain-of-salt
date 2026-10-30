/**
 * Format a date into a human-friendly relative time string (e.g. "just now", "5 minutes ago", "2 hours ago", "3 days ago").
 */
export function formatRelativeTime(dateInput: Date | string | number | null | undefined): string {
	if (!dateInput) return '';
	const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
	const time = date.getTime();
	if (Number.isNaN(time)) return '';

	const diffMs = Date.now() - time;
	const diffSec = Math.floor(diffMs / 1000);
	if (diffSec < 60) return 'just now';

	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) {
		return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
	}

	const diffHours = Math.floor(diffMin / 60);
	if (diffHours < 24) {
		return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
	}

	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 30) {
		return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
	}

	const diffMonths = Math.floor(diffDays / 30);
	if (diffMonths < 12) {
		return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
	}

	const diffYears = Math.floor(diffDays / 365);
	return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
}
