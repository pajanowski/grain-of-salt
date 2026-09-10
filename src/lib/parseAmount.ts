// Accepts: decimals (3.25), integers (3), simple fractions (1/3), mixed numbers (1 1/2)
// Returns { value?: number; error?: string }, rounds to 3 decimal places
export function parseAmount(raw: string): { value?: number; error?: string } {
	if (!raw.trim()) return { value: 0 };
	const trimmed = raw.trim();
	// Try decimal / integer first
	if (/^\d+(\.\d+)?$/.test(trimmed)) {
		return { value: Math.round(parseFloat(trimmed) * 1000) / 1000 };
	}
	// Mixed number: e.g. "1 1/2"
	const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
	if (mixedMatch) {
		const whole = parseInt(mixedMatch[1], 10);
		const num = parseInt(mixedMatch[2], 10);
		const denom = parseInt(mixedMatch[3], 10);
		if (denom === 0) return { error: 'Denominator cannot be zero' };
		const v = whole + num / denom;
		return { value: Math.round(v * 1000) / 1000 };
	}
	// Simple fraction: e.g. "2/3"
	const fracMatch = trimmed.match(/^(\d+)\/(\d+)$/);
	if (fracMatch) {
		const num = parseInt(fracMatch[1], 10);
		const denom = parseInt(fracMatch[2], 10);
		if (denom === 0) return { error: 'Denominator cannot be zero' };
		const v = num / denom;
		return { value: Math.round(v * 1000) / 1000 };
	}
	return { error: 'Invalid amount' };
}
