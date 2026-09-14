/**
 * Browser-side tests for the IMask-based direction body mask mounted on
 * a real DOM `<textarea>`. These run in the `client` project (browser /
 * playwright) so we can exercise the view layer end-to-end.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import IMask from 'imask';
import { createDirectionMask } from './directionMask';
import type { Ingredient } from './Recipe.svelte';

function makeIngredient(id: string, name: string, amount: number, unit: string): Ingredient {
	return { id, name, amount, unit };
}

const SUGAR_ID = 'a3f2e1c4-9b8d-4a01-b2c3-4d5e6f708192';
const SALT_ID = 'b91c7d4e-1234-5678-9abc-def012345678';

describe('DirectionMasked mounted on a <textarea>', () => {
	let textarea: HTMLTextAreaElement;
	let mask: ReturnType<typeof IMask> | null;

	beforeEach(() => {
		textarea = document.createElement('textarea');
		textarea.value = '';
		document.body.appendChild(textarea);
		mask = null;
	});

	afterEach(() => {
		mask?.destroy();
		mask = null;
		textarea.remove();
	});

	function mount(ingredients: Ingredient[], initial: string) {
		mask = IMask(textarea, {
			mask: createDirectionMask({ ingredients })
		});
		mask.value = initial;
		return mask;
	}

	it('displays #name in the DOM when value is set programmatically', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		mount([sugar], `Add #${SUGAR_ID} to the bowl.`);
		expect(textarea.value).toBe('Add #Sugar to the bowl.');
	});

	it('unmaskedValue reads back the raw #uuid body', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		mount([sugar], `Add #${SUGAR_ID} to the bowl.`);
		expect(mask?.unmaskedValue).toBe(`Add #${SUGAR_ID} to the bowl.`);
	});

	it('round-trips: writing unmaskedValue preserves the raw body', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const raw = `Stir #${SUGAR_ID} then #${SUGAR_ID} again.`;
		const m = mount([sugar], '');
		m.unmaskedValue = raw;
		expect(m.unmaskedValue).toBe(raw);
		expect(m.value).toBe(raw);
	});

	it('treats unmapped ingredients as missing references', () => {
		const salt = makeIngredient(SALT_ID, 'Salt', 0.5, 'tsp');
		mount([salt], `Add #${SUGAR_ID} and #${SALT_ID}.`);
		expect(textarea.value).toBe(`Add #${SUGAR_ID} and #Salt.`);
		expect(mask?.unmaskedValue).toBe(`Add #${SUGAR_ID} and #${SALT_ID}.`);
	});

	it('renders the initial body formatted on mount', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		// Setting initial value via IMask constructor opts would work too,
		// but we go through `value =` to mirror how the Svelte layer
		// will hand the body in once direction editing is wired up.
		mask = IMask(textarea, {
			mask: createDirectionMask({ ingredients: [sugar] })
		});
		mask.value = `Mix #${SUGAR_ID}.`;
		expect(textarea.value).toBe('Mix #Sugar.');
	});

	it('destroy() detaches listeners so the textarea is editable again', () => {
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const m = mount([sugar], `Add #${SUGAR_ID}.`);
		expect(textarea.value).toBe('Add #Sugar.');
		m.destroy();
		// After destroy, IMask no longer rewrites the DOM value when we
		// assign raw text directly.
		textarea.value = `Raw #${SUGAR_ID} stays raw.`;
		expect(textarea.value).toBe(`Raw #${SUGAR_ID} stays raw.`);
	});
});
