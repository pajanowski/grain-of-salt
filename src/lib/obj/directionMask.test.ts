/**
 * Tests for the IMask-based direction body mask.
 *
 * The mask should:
 * - Replace `#<uuid>` references with `#<ingredient-name>`.
 * - Pass through unknown references unchanged.
 * - Round-trip: typing the raw body in preserves the raw body in
 *   `value` / `unmaskedValue` while `displayValue` reads back the
 *   formatted version.
 * - Coexist with arbitrary prose that contains `#` characters that are
 *   not part of a uuid.
 *
 * The mask is exercised at three levels:
 *  1. Pure `formatDirectionBody(body, ingredients)` — pure function.
 *  2. `DirectionMasked` directly — verify `value` vs `displayValue`.
 *  3. `IMask(el, { mask: createDirectionMask(...) })` — wire a real
 *     DOM `<textarea>` through IMask's view layer (covered in
 *     `directionMask.svelte.test.ts` since it needs the browser).
 */
import { describe, it, expect } from 'vitest';
import {
	buildIngredientDisplayName,
	formatDirectionBody,
	createDirectionMask,
	UUID_TOKEN,
	tokenizeMaskedBody,
	displayToRaw,
	rawToDisplay
} from './directionMask';
import type { Ingredient } from './Recipe.svelte';

function makeIngredient(
	id: string,
	name: string,
	amount: number | string = 0,
	unit: string = ''
): Ingredient {
	// Accept either numeric amounts or strings (covers test fixtures
	// that exercise the display-name helper without depending on
	// numeric arithmetic).
	const numeric = typeof amount === 'number' ? amount : Number(amount);
	return { id, name, amount: Number.isFinite(numeric) ? numeric : 0, unit };
}

const SUGAR_ID = 'a3f2e1c4-9b8d-4a01-b2c3-4d5e6f708192';
const SALT_ID = 'b91c7d4e-1234-5678-9abc-def012345678';
const FLOUR_ID = 'c3f2e1c4-9b8d-4a01-b2c3-4d5e6f708193';

describe('formatDirectionBody', () => {
	it('replaces a known #uuid with #<name>', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const body = `Add #${SUGAR_ID} to the bowl.`;
		expect(formatDirectionBody(body, [sugar])).toBe('Add #Sugar to the bowl.');
	});

	it('leaves unknown #uuid tokens alone', () => {
		const unknown = 'd3f2e1c4-9b8d-4a01-b2c3-4d5e6f7081ff';
		const body = `Add #${unknown} to the bowl.`;
		expect(formatDirectionBody(body, [])).toBe(body);
	});

	it('does not transform `#` followed by non-hex characters', () => {
		const body = 'Try #tag or #3-style #abc  #1234 (not a uuid).';
		expect(formatDirectionBody(body, [])).toBe(body);
	});

	it('replaces multiple tokens in one body', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const salt = makeIngredient(SALT_ID, 'Salt', 0.5, 'tsp');
		const body = `Mix #${SUGAR_ID} and #${SALT_ID} together.`;
		expect(formatDirectionBody(body, [sugar, salt])).toBe('Mix #Sugar and #Salt together.');
	});

	it('handles empty body', () => {
		expect(formatDirectionBody('', [])).toBe('');
	});

	it('matches uuids case-insensitively (uuids are stored lowercased)', () => {
		const sugar = makeIngredient(SUGAR_ID.toLowerCase(), 'Sugar', 1, 'cup');
		const body = `Add #${SUGAR_ID.toUpperCase()} please.`;
		expect(formatDirectionBody(body, [sugar])).toBe('Add #Sugar please.');
	});

	it('preserves leading/trailing whitespace and punctuation around tokens', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const body = `(#${SUGAR_ID})`;
		expect(formatDirectionBody(body, [sugar])).toBe('(#Sugar)');
	});

	it('does not match adjacent `#uuid-#uuid` as one greedy match', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const salt = makeIngredient(SALT_ID, 'Salt', 0.5, 'tsp');
		const body = `Stir in #${SUGAR_ID}#${SALT_ID}.`;
		expect(formatDirectionBody(body, [sugar, salt])).toBe('Stir in #Sugar#Salt.');
	});

	it('is null-safe when ingredients list is empty', () => {
		const body = `Add #${SUGAR_ID}.`;
		expect(formatDirectionBody(body, [])).toBe(body);
	});
});

describe('buildIngredientDisplayName', () => {
	it('returns just the name when there is no amount and no unit', () => {
		expect(buildIngredientDisplayName(makeIngredient(SUGAR_ID, 'Sugar'))).toBe('Sugar');
	});

	it('formats `name (amount unit)` when both are present', () => {
		expect(buildIngredientDisplayName(makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup'))).toBe(
			'Sugar (1 cup)'
		);
	});

	it('formats `name (unit)` when amount is 0 but unit is present', () => {
		expect(buildIngredientDisplayName(makeIngredient(SUGAR_ID, 'Salt', 0, 'to taste'))).toBe(
			'Salt (to taste)'
		);
	});

	it('formats `name (amount)` when amount > 0 but unit is empty', () => {
		expect(buildIngredientDisplayName(makeIngredient(SUGAR_ID, 'Sugar', 2, ''))).toBe('Sugar (2)');
	});

	it('formats fractions via formatAmount', () => {
		expect(buildIngredientDisplayName(makeIngredient(SUGAR_ID, 'Sugar', 0.5, 'cup'))).toBe(
			'Sugar (1/2 cup)'
		);
		expect(buildIngredientDisplayName(makeIngredient(SUGAR_ID, 'Sugar', 1.5, 'cups'))).toBe(
			'Sugar (1 1/2 cups)'
		);
	});
});

describe('UUID_TOKEN', () => {
	it('matches a canonical lowercase uuid preceded by #', () => {
		UUID_TOKEN.lastIndex = 0;
		expect(`#${SUGAR_ID}`.match(UUID_TOKEN)?.[0]).toBe(`#${SUGAR_ID}`);
	});

	it('is case-insensitive', () => {
		UUID_TOKEN.lastIndex = 0;
		expect(`#${SUGAR_ID.toUpperCase()}`.match(UUID_TOKEN)?.[0]).toBe(`#${SUGAR_ID.toUpperCase()}`);
	});

	it('does not match a too-short hash', () => {
		UUID_TOKEN.lastIndex = 0;
		expect('#abc'.match(UUID_TOKEN)).toBeNull();
	});

	it('does not match non-hex characters', () => {
		UUID_TOKEN.lastIndex = 0;
		expect('#z3f2e1c4-9b8d-4a01-b2c3-4d5e6f708192'.match(UUID_TOKEN)).toBeNull();
	});
});

describe('DirectionMasked (model layer)', () => {
	const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
	const flour = makeIngredient(FLOUR_ID, 'Flour', 2.5, 'cups');

	it('exposes ingredients passed at construction', () => {
		const masked = createDirectionMask({ ingredients: [sugar] });
		expect(masked.ingredients).toEqual([sugar]);
	});

	it('value and unmaskedValue hold the raw body', () => {
		const masked = createDirectionMask({ ingredients: [sugar] });
		masked.value = `Add #${SUGAR_ID} please.`;
		expect(masked.value).toBe(`Add #${SUGAR_ID} please.`);
		expect(masked.unmaskedValue).toBe(`Add #${SUGAR_ID} please.`);
	});

	it('displayValue shows the formatted body with #name', () => {
		const masked = createDirectionMask({ ingredients: [sugar] });
		masked.value = `Add #${SUGAR_ID} please.`;
		expect(masked.displayValue).toBe('Add #Sugar please.');
	});

	it('formats multiple tokens in one body', () => {
		const salt = makeIngredient(SALT_ID, 'Salt', 0.5, 'tsp');
		const masked = createDirectionMask({ ingredients: [sugar, salt] });
		masked.value = `Mix #${SUGAR_ID} and #${SALT_ID} together.`;
		expect(masked.displayValue).toBe('Mix #Sugar and #Salt together.');
	});

	it('leaves unknown #uuid references untouched in displayValue', () => {
		const unknown = 'd3f2e1c4-9b8d-4a01-b2c3-4d5e6f7081ff';
		const masked = createDirectionMask({ ingredients: [sugar] });
		masked.value = `Add #${unknown} to the bowl.`;
		expect(masked.displayValue).toBe(`Add #${unknown} to the bowl.`);
		expect(masked.value).toBe(`Add #${unknown} to the bowl.`);
	});

	it('falls back to plain text when there are no tokens at all', () => {
		const masked = createDirectionMask({ ingredients: [sugar] });
		masked.value = 'Stir the mixture gently.';
		expect(masked.value).toBe('Stir the mixture gently.');
		expect(masked.displayValue).toBe('Stir the mixture gently.');
	});

	it('handles empty body', () => {
		const masked = createDirectionMask({ ingredients: [sugar] });
		masked.value = '';
		expect(masked.value).toBe('');
		expect(masked.displayValue).toBe('');
		expect(masked.unmaskedValue).toBe('');
	});

	it('reflects updated ingredients after updateOptions', () => {
		const masked = createDirectionMask({ ingredients: [sugar] });
		masked.value = `Whisk in #${FLOUR_ID}.`;
		expect(masked.displayValue).toBe(`Whisk in #${FLOUR_ID}.`); // unknown without flour
		masked.updateOptions({ ingredients: [sugar, flour] });
		expect(masked.displayValue).toBe('Whisk in #Flour.');
	});

	it('accepts arbitrary prose with non-uuid # characters', () => {
		const masked = createDirectionMask({ ingredients: [sugar] });
		masked.value = 'Add #tag, then #3 colors, finally #' + SUGAR_ID;
		expect(masked.value).toBe('Add #tag, then #3 colors, finally #' + SUGAR_ID);
		expect(masked.displayValue).toBe('Add #tag, then #3 colors, finally #Sugar');
	});

	it('does not collapse adjacent tokens', () => {
		const salt = makeIngredient(SALT_ID, 'Salt', 0.5, 'tsp');
		const masked = createDirectionMask({ ingredients: [sugar, salt] });
		masked.value = `Stir in #${SUGAR_ID}#${SALT_ID}.`;
		expect(masked.displayValue).toBe('Stir in #Sugar#Salt.');
	});
});

describe('tokenizeMaskedBody', () => {
	it('returns a plain-text display when there are no tokens', () => {
		const m = tokenizeMaskedBody('Just plain text.', []);
		expect(m.display).toBe('Just plain text.');
		expect(m.segments).toHaveLength(1);
		expect(m.segments[0].type).toBe('text');
	});

	it('resolves known #uuid tokens to chip segments and offsets them in raw + display', () => {
		const m = tokenizeMaskedBody(`Add #${SUGAR_ID} now.`, [
			makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup')
		]);
		expect(m.display).toBe('Add #Sugar now.');
		expect(m.segments).toHaveLength(3);
		// text "Add "
		expect(m.segments[0].type).toBe('text');
		expect(m.segments[0].value).toBe('Add ');
		expect(m.segments[0].rawStart).toBe(0);
		expect(m.segments[0].rawEnd).toBe(4);
		expect(m.segments[0].displayStart).toBe(0);
		expect(m.segments[0].displayEnd).toBe(4);
		// chip "#Sugar"
		expect(m.segments[1].type).toBe('chip');
		expect(m.segments[1].value).toBe('#Sugar');
		expect(m.segments[1].displayEnd - m.segments[1].displayStart).toBe(6);
		expect(m.segments[1].rawEnd - m.segments[1].rawStart).toBe(1 + SUGAR_ID.length);
		// text " now."
		expect(m.segments[2].value).toBe(' now.');
	});

	it('keeps unknown uuids as chips with the raw uuid as the displayed value', () => {
		const m = tokenizeMaskedBody(`Add #${SUGAR_ID}.`, []);
		expect(m.display).toBe(`Add #${SUGAR_ID}.`);
		expect(m.segments[1].type).toBe('chip');
		expect(m.segments[1].ingredient).toBeNull();
		expect(m.segments[1].value).toBe(`#${SUGAR_ID}`);
	});

	it('handles multiple tokens in one body', () => {
		const m = tokenizeMaskedBody(`Mix #${SUGAR_ID} and #${SALT_ID}.`, [
			makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup'),
			makeIngredient(SALT_ID, 'Salt', 0.5, 'tsp')
		]);
		expect(m.display).toBe('Mix #Sugar and #Salt.');
		expect(m.segments.filter((s) => s.type === 'chip')).toHaveLength(2);
	});
});

describe('displayToRaw / rawToDisplay', () => {
	function setupBody(body: string, ingredients: Ingredient[]) {
		const m = tokenizeMaskedBody(body, ingredients);
		return m;
	}

	it('maps positions outside tokens 1:1', () => {
		const m = setupBody(`Add #${SUGAR_ID}.`, [makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup')]);
		// Display: "Add #Sugar."  (length 11)
		// Raw:     `Add #<SUGAR_ID>.` (length 42 = "Add " (4) + "#" (1) + uuid (36) + "." (1))
		expect(m.display).toBe('Add #Sugar.');
		expect(m.display.length).toBe(11);
		// Text "Add " at the start: positions map 1:1.
		expect(displayToRaw(0, m)).toBe(0);
		expect(displayToRaw(3, m)).toBe(3);
		// Position 4 is the leading `#` of the chip — maps to chip rawStart.
		expect(displayToRaw(4, m)).toBe(4);
		// Positions strictly inside the chip snap to its left edge
		// (the chip is atomic; we never split it).
		expect(displayToRaw(7, m)).toBe(4);
		// Position equal to chip displayEnd maps to chip rawEnd.
		expect(displayToRaw(10, m)).toBe(4 + 1 + SUGAR_ID.length);
		// Trailing "." text — beyond chip end maps onto the raw tail.
		expect(displayToRaw(11, m)).toBe(42);
	});

	it('handles a body with no chips', () => {
		const m = setupBody('plain text', []);
		expect(displayToRaw(0, m)).toBe(0);
		expect(displayToRaw(5, m)).toBe(5);
		expect(displayToRaw(20, m)).toBeGreaterThanOrEqual(m.display.length);
	});

	it('handles a body whose chips are smaller/larger than the underlying uuids', () => {
		const longNameId = SUGAR_ID;
		const m = setupBody(`#${longNameId}`, [makeIngredient(longNameId, 'X', 0, '')]);
		// Display "#X" (2 chars) vs raw `#<36 chars>` (37 chars).
		expect(m.display).toBe('#X');
		expect(displayToRaw(0, m)).toBe(0);
		expect(displayToRaw(1, m)).toBe(0); // inside chip → left edge
		expect(displayToRaw(2, m)).toBe(1 + longNameId.length);
	});

	it('round-trips display positions through rawToDisplay', () => {
		const m = setupBody(`Hello #${SUGAR_ID} world.`, [
			makeIngredient(SUGAR_ID, 'Sugar')
		]);
		// Display: "Hello #Sugar world." (length 19)
		expect(m.display).toBe('Hello #Sugar world.');
		// Position 6 (the "#") is the chip start in display.
		expect(rawToDisplay(displayToRaw(6, m), m)).toBe(6);
		// Position right after the chip end in raw maps to display end of chip.
		const rawChipEnd = m.segments.find((s) => s.type === 'chip')!.rawEnd;
		expect(rawToDisplay(rawChipEnd, m)).toBe(12); // "Hello #Sugar" length
	});
});

