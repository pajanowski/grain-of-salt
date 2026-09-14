/**
 * Tests for the `use:directionMask` Svelte action.
 *
 * The action wraps a textarea with the `DirectionMasked` IMask model so
 * that, on the same DOM node:
 * - **focused**: the textarea shows the raw `#uuid` body (so the
 *   `#`-trigger picker regex matches).
 * - **blurred**: the textarea shows the formatted `#<name>` body
 *   produced by the mask's `displayValue`.
 *
 * Sync with the parent model is bidirectional: the action mirrors
 * `mask.value` (raw) back to the parent via `setValue` after each
 * `accept` event.
 *
 * These tests run in the `client` (browser / playwright) project so they
 * exercise a real DOM textarea + IMask event plumbing.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { directionMask, type DirectionMaskHandle } from './directionMask';
import type { Ingredient } from '../obj/Recipe.svelte';

/**
 * Minimal ActionReturn shape the action returns at runtime. Svelte's
 * `Action<...>` type allows `void | ActionReturn<...>` so we cast the
 * concrete return through this interface in the tests.
 */
interface ActionHandle extends DirectionMaskHandle {
	update?: (params: { ingredients: Ingredient[]; getValue: () => string; setValue: (v: string) => void }) => void;
	destroy?: () => void;
}

function makeIngredient(id: string, name: string, amount = 0, unit = ''): Ingredient {
	return { id, name, amount, unit };
}

const SUGAR_ID = 'a3f2e1c4-9b8d-4a01-b2c3-4d5e6f708192';
const SALT_ID = 'b91c7d4e-1234-5678-9abc-def012345678';

interface Probe {
	textarea: HTMLTextAreaElement;
	host: HTMLDivElement;
	raw: string;
	observed: string[];
}

function setup(): Probe {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const textarea = document.createElement('textarea');
	host.appendChild(textarea);
	return { host, textarea, raw: '', observed: [] };
}

function teardown(p: Probe) {
	p.host.remove();
}

function attach(p: Probe, ingredients: Ingredient[]): ActionHandle {
	const ret = directionMask(p.textarea, {
		ingredients,
		getValue: () => p.raw,
		setValue: (v: string) => {
			p.raw = v;
			p.observed.push(v);
		}
	});
	if (!ret || typeof ret !== 'object') {
		throw new Error('directionMask did not return an ActionHandle');
	}
	return ret as unknown as ActionHandle;
}

function cleanup(action: ActionHandle) {
	if (typeof action.destroy === 'function') action.destroy();
}

describe('use:directionMask action', () => {
	let p: Probe;

	beforeEach(() => {
		p = setup();
	});

	afterEach(() => {
		teardown(p);
	});

	it('shows formatted display by default', () => {
		p.raw = `Add #${SUGAR_ID} to the bowl.`;
		const action = attach(p, [makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup')]);
		try {
			expect(p.textarea.value).toBe('Add #Sugar to the bowl.');
		} finally {
			cleanup(action);
		}
	});

	it('swaps to raw when the textarea is focused', () => {
		p.raw = `Add #${SUGAR_ID} please.`;
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const action = attach(p, [sugar]);
		try {
			expect(p.textarea.value).toBe('Add #Sugar please.');
			p.textarea.dispatchEvent(new FocusEvent('focus'));
			expect(p.textarea.value).toBe(`Add #${SUGAR_ID} please.`);
		} finally {
			cleanup(action);
		}
	});

	it('swaps back to formatted on blur', () => {
		p.raw = `Add #${SUGAR_ID} please.`;
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const action = attach(p, [sugar]);
		try {
			p.textarea.dispatchEvent(new FocusEvent('focus'));
			expect(p.textarea.value).toBe(`Add #${SUGAR_ID} please.`);
			p.textarea.dispatchEvent(new FocusEvent('blur'));
			expect(p.textarea.value).toBe('Add #Sugar please.');
		} finally {
			cleanup(action);
		}
	});

	it('mirrors user input back to the raw model via setValue', () => {
		p.raw = `Add #${SUGAR_ID} please.`;
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const action = attach(p, [sugar]);
		try {
			p.textarea.dispatchEvent(new FocusEvent('focus'));
			p.textarea.value = `Add #${SUGAR_ID} extra.`;
			p.textarea.dispatchEvent(new Event('input', { bubbles: true }));
			expect(p.observed).toContain(`Add #${SUGAR_ID} extra.`);
			expect(p.raw).toBe(`Add #${SUGAR_ID} extra.`);
		} finally {
			cleanup(action);
		}
	});

	it('reflects updates to the raw body passed via getValue', () => {
		p.raw = `Add #${SUGAR_ID}.`;
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const salt = makeIngredient(SALT_ID, 'Salt', 0.5, 'tsp');
		const action = attach(p, [sugar]);
		try {
			// Blurred (default): textarea shows formatted #Sugar.
			expect(p.textarea.value).toBe('Add #Sugar.');
			// Update props: include salt; getValue now returns the new raw.
			p.raw = `Add #${SUGAR_ID} and #${SALT_ID}.`;
			action.update?.({
				ingredients: [sugar, salt],
				getValue: () => p.raw,
				setValue: (v: string) => {
					p.raw = v;
				}
			});
			expect(p.textarea.value).toBe('Add #Sugar and #Salt.');
			// Focus -> swap to raw
			p.textarea.dispatchEvent(new FocusEvent('focus'));
			expect(p.textarea.value).toBe(`Add #${SUGAR_ID} and #${SALT_ID}.`);
		} finally {
			cleanup(action);
		}
	});

	it('passes unknown #uuid through unchanged in display', () => {
		const unknown = 'd3f2e1c4-9b8d-4a01-b2c3-4d5e6f7081ff';
		p.raw = `Add #${unknown} to the bowl.`;
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const action = attach(p, [sugar]);
		try {
			expect(p.textarea.value).toBe(`Add #${unknown} to the bowl.`);
		} finally {
			cleanup(action);
		}
	});

	it('updates display when ingredients change', () => {
		p.raw = `Whisk in #${SALT_ID}.`;
		const sugar = makeIngredient(SUGAR_ID, 'Sugar', 1, 'cup');
		const salt = makeIngredient(SALT_ID, 'Salt', 0.5, 'tsp');
		const action = attach(p, [sugar]);
		try {
			expect(p.textarea.value).toBe(`Whisk in #${SALT_ID}.`);
			action.update?.({
				ingredients: [sugar, salt],
				getValue: () => p.raw,
				setValue: (v: string) => {
					p.raw = v;
				}
			});
			expect(p.textarea.value).toBe('Whisk in #Salt.');
		} finally {
			cleanup(action);
		}
	});
});
