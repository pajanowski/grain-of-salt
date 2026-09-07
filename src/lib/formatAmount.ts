/**
 * Format a numeric ingredient amount as a human-readable string.
 * Whole numbers render as integers (1 → "1"); fractional parts map to
 * common cooking fractions (0.5 → "1/2", 0.25 → "1/4"). Falls back to
 * the raw decimal when no clean fraction matches.
 */
export function formatAmount(amount: number): string {
	if (!amount || !isFinite(amount)) return '';
	const integerPart = Math.floor(amount);
	const fractionPart = amount - integerPart;
	for (const [val, str] of COMMON_FRACTIONS) {
		if (Math.abs(fractionPart - val) < 0.02) {
			return integerPart > 0 ? `${integerPart} ${str}` : str;
		}
	}
	return parseFloat(amount.toFixed(2)).toString();
}

const COMMON_FRACTIONS: [number, string][] = [
	[1 / 8, '1/8'],
	[1 / 4, '1/4'],
	[1 / 3, '1/3'],
	[3 / 8, '3/8'],
	[1 / 2, '1/2'],
	[5 / 8, '5/8'],
	[2 / 3, '2/3'],
	[3 / 4, '3/4'],
	[7 / 8, '7/8']
];
