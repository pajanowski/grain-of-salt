import { describe, it, expect } from 'vitest';
import { displayUnit } from './unit';

describe('displayUnit', () => {
	it('returns singular when amount is 1', () => {
		expect(displayUnit('cup', 1)).toBe('cup');
	});

	it('appends s when amount is anything other than 1', () => {
		expect(displayUnit('cup', 2)).toBe('cups');
		expect(displayUnit('cup', 0.5)).toBe('cups');
	});

	it('returns the canonical form when amount is non-finite', () => {
		expect(displayUnit('cup', Infinity)).toBe('cup');
		expect(displayUnit('cup', NaN)).toBe('cup');
	});

	it('returns empty string when unit is empty, regardless of amount', () => {
		// Bug: previously returned 's' for any non-1 amount, which appended
		// a stray "s" to ingredients that had no unit (e.g. "Onions" + "" + "s").
		expect(displayUnit('', 0)).toBe('');
		expect(displayUnit('', 2)).toBe('');
		expect(displayUnit('', 1)).toBe('');
	});
});
