import { describe, it, expect } from 'vitest';
import { compileDirection } from './directionCompile';
import type { Ingredient } from './Recipe.svelte';

function makeIngredient(id: string, name: string, amount: number, unit: string): Ingredient {
	return { id, name, amount, unit };
}

const SUGAR_ID = 'a3f2e1c4-9b8d-4a01-b2c3-4d5e6f708192';
const SALT_ID = 'b91c7d4e-1234-5678-9abc-def012345678';

describe('compileDirection', () => {
	it('simple body with one resolved #uuid -> one chip + text segments', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const body = 'Add #' + SUGAR_ID + ' to the bowl.';
		const result = compileDirection(body, [sugar]);

		expect(result.compiled).toHaveLength(3);
		expect(result.compiled[0]).toEqual({ type: 'text', value: 'Add ' });
		expect(result.compiled[1]).toEqual({
			type: 'chip',
			id: SUGAR_ID,
			ingredient: sugar,
			displayText: 'Sugar (1 cup)',
			start: 4,
			end: 4 + SUGAR_ID.length + 1
		});
		expect(result.compiled[2]).toEqual({ type: 'text', value: ' to the bowl.' });
		expect(result.tokens).toHaveLength(1);
		expect(result.tokens[0].id).toBe(SUGAR_ID.toLowerCase());
	});

	it('body with two #uuid references -> two chips', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const salt = makeIngredient(SALT_ID, 'Salt', 0.5, 'tsp');
		const body = `Mix #${SUGAR_ID} and #${SALT_ID} together.`;
		const result = compileDirection(body, [sugar, salt]);

		expect(result.compiled).toHaveLength(5);
		expect(result.compiled[0]).toEqual({ type: 'text', value: 'Mix ' });
		expect(result.compiled[1].type).toBe('chip');
		expect((result.compiled[1] as any).displayText).toBe('Sugar (1 cup)');
		expect(result.compiled[2]).toEqual({ type: 'text', value: ' and ' });
		expect(result.compiled[3].type).toBe('chip');
		expect((result.compiled[3] as any).displayText).toBe('Salt (1/2 tsp)');
		expect(result.compiled[4]).toEqual({ type: 'text', value: ' together.' });
		expect(result.tokens).toHaveLength(2);
	});

	it('body with unknown uuid -> renders literally as #uuid text', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const unknownId = 'c3f2e1c4-9b8d-4a01-b2c3-4d5e6f708193';
		const body = `Add #${unknownId} to the bowl.`;
		const result = compileDirection(body, [sugar]);

		// Unknown uuid: compiled has text before + chip for the token + text after
		expect(result.compiled).toHaveLength(3);
		expect(result.compiled[0]).toEqual({ type: 'text', value: 'Add ' });
		expect(result.compiled[1]).toEqual({
			type: 'chip',
			id: unknownId,
			ingredient: null,
			displayText: `#${unknownId}`,
			start: 4,
			end: 4 + unknownId.length + 1
		});
		expect(result.compiled[2]).toEqual({ type: 'text', value: ' to the bowl.' });
		expect(result.tokens).toHaveLength(1);
		expect(result.tokens[0].ingredient).toBeNull();
		expect(result.tokens[0].id).toBe(unknownId);
	});

	it('body with no references -> just one text segment', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const body = 'Stir the mixture gently.';
		const result = compileDirection(body, [sugar]);

		expect(result.compiled).toHaveLength(1);
		expect(result.compiled[0]).toEqual({ type: 'text', value: body });
		expect(result.tokens).toHaveLength(0);
	});

	describe('display text edge cases', () => {
		it('amount 0, unit empty -> just name', () => {
			const ingredient = makeIngredient(SUGAR_ID, 'Sugar', 0, '');
			const body = `Add #${SUGAR_ID} to the bowl.`;
			const result = compileDirection(body, [ingredient]);

			expect((result.compiled[1] as any).displayText).toBe('Sugar');
		});

		it('amount > 0, unit empty -> name (amount)', () => {
			const ingredient = makeIngredient(SUGAR_ID, 'Sugar', 2, '');
			const body = `Add #${SUGAR_ID} to the bowl.`;
			const result = compileDirection(body, [ingredient]);

			expect((result.compiled[1] as any).displayText).toBe('Sugar (2)');
		});

		it('amount 0, unit present -> name (unit)', () => {
			const ingredient = makeIngredient(SUGAR_ID, 'Salt', 0, 'to taste');
			const body = `Add #${SUGAR_ID} to the bowl.`;
			const result = compileDirection(body, [ingredient]);

			expect((result.compiled[1] as any).displayText).toBe('Salt (to taste)');
		});

		it('both amount and unit present -> name (amount unit)', () => {
			const ingredient = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
			const body = `Add #${SUGAR_ID} to the bowl.`;
			const result = compileDirection(body, [ingredient]);

			expect((result.compiled[1] as any).displayText).toBe('Sugar (1 cup)');
		});
	});

	describe('fractional amount formatting', () => {
		it('amount 0.5 formats as 1/2', () => {
			const ingredient = makeIngredient(SUGAR_ID, 'Sugar', 0.5, 'cup');
			const body = `Add #${SUGAR_ID}.`;
			const result = compileDirection(body, [ingredient]);

			expect((result.compiled[1] as any).displayText).toBe('Sugar (1/2 cup)');
		});

		it('amount 1.5 formats as 1 1/2', () => {
			const ingredient = makeIngredient(SUGAR_ID, 'Sugar', 1.5, 'cups');
			const body = `Add #${SUGAR_ID}.`;
			const result = compileDirection(body, [ingredient]);

			expect((result.compiled[1] as any).displayText).toBe('Sugar (1 1/2 cups)');
		});
	});

	it('multiple references in one body', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const salt = makeIngredient(SALT_ID, 'Salt', 0.5, 'tsp');
		const flourId = 'd3f2e1c4-9b8d-4a01-b2c3-4d5e6f708194';
		const flour = makeIngredient(flourId, 'Flour', 2.5, 'cups');
		const body = `Combine #${SUGAR_ID}, #${SALT_ID}, and #${flourId}.`;
		const result = compileDirection(body, [sugar, salt, flour]);

		expect(result.tokens).toHaveLength(3);
		expect(result.compiled.filter((s) => s.type === 'chip')).toHaveLength(3);
	});

	it('empty body', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const result = compileDirection('', [sugar]);

		expect(result.compiled).toHaveLength(1);
		expect(result.compiled[0]).toEqual({ type: 'text', value: '' });
		expect(result.tokens).toHaveLength(0);
	});
});
