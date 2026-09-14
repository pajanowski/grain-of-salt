/**
 * Svelte action that mounts an `IMask`-based `DirectionMasked` on a
 * `<textarea>` and keeps it in sync with a Svelte model holding the
 * raw direction body (i.e. with `#<uuid>` references still intact).
 *
 * Display contract:
 * - When the textarea is **focused**, the value shown is the raw body
 *   (`#a3f2-...`) so the `#`-trigger ingredient picker can detect the
 *   trailing token and the existing backspace handling matches.
 * - When the textarea is **blurred**, IMask renders the formatted body
 *   (`#Sugar`) via the mask's `displayValue`. The raw model is
 *   preserved unchanged.
 *
 * Sync contract with the parent:
 * - On mount, the action reads the current raw body from `getValue()`
 *   and pushes it into the mask.
 * - After every IMask `accept` event (i.e. the user changed something
 *   while focused), the action reads `mask.value` (raw) and pushes it
 *   to `setValue(raw)`.
 * - A parent that mutates the raw body externally (e.g. via
 *   `selectionChange` and the chip's Change/Remove handlers) can call
 *   `action.syncFromProps()` to push the latest raw body back into
 *   the mask.
 *
 * Usage:
 *
 *   let body = $state('Add #a-3f-2e... to the bowl');
 *   let taRef: HTMLTextAreaElement | null = $state(null);
 *
 *   <textarea
 *     bind:this={taRef}
 *     use:directionMask={{
 *       ingredients,
 *       getValue: () => body,
 *       setValue: (v) => body = v
 *     }}
 *   ></textarea>
 *
 * The action handles focus/blur internally; Svelte should bind the
 * textarea without `bind:value` to avoid double-write conflicts with
 * IMask.
 */
import type { Action } from 'svelte/action';
import IMask from 'imask';
import type { Ingredient } from '../obj/Recipe.svelte.js';
import { createDirectionMask, type DirectionMasked } from '../obj/directionMask.js';

export interface DirectionMaskParams {
	ingredients: Ingredient[];
	getValue: () => string;
	setValue: (raw: string) => void;
	/**
	 * Optional callback fired after each user-driven change. Receives
	 * the new raw body.
	 */
	onAccept?: (raw: string) => void;
}

/** Handle returned by the action; use it to drive the mask imperatively. */
export interface DirectionMaskHandle {
	getMask: () => ReturnType<typeof IMask>;
	getModel: () => DirectionMasked;
	syncFromProps: () => void;
}

export const directionMask: Action<HTMLTextAreaElement, DirectionMaskParams> = (
	node,
	params
) => {
	let mask: ReturnType<typeof IMask> | null = null;
	let currentParams: DirectionMaskParams = params;
	let lastSeenRaw = '';

	function pushInitial() {
		if (!mask) return;
		const raw = currentParams.getValue();
		if (raw !== lastSeenRaw) {
			mask.value = raw;
			lastSeenRaw = raw;
		}
	}

	function attach() {
		const model = createDirectionMask({ ingredients: currentParams.ingredients });
		mask = IMask(node, { mask: model });
		mask.on('accept', () => {
			if (!mask) return;
			const raw = mask.value ?? '';
			if (raw !== lastSeenRaw) {
				lastSeenRaw = raw;
				currentParams.setValue(raw);
				currentParams.onAccept?.(raw);
			}
		});
		pushInitial();
	}

	function detach() {
		mask?.destroy();
		mask = null;
	}

	function onFocus() {
		if (!mask) return;
		const raw = mask.value ?? '';
		if (node.value !== raw) node.value = raw;
	}

	function onBlur() {
		if (!mask) return;
		mask.updateControl('auto');
		const display = mask.displayValue;
		if (node.value !== display) node.value = display;
	}

	node.addEventListener('focus', onFocus);
	node.addEventListener('blur', onBlur);
	attach();

	return {
		update(next: DirectionMaskParams) {
			const ingredientsChanged = next.ingredients !== currentParams.ingredients;
			const getValueChanged = next.getValue !== currentParams.getValue;
			const setValueChanged = next.setValue !== currentParams.setValue;
			currentParams = next;

			if (ingredientsChanged && mask) {
				mask.updateOptions({ ingredients: next.ingredients });
			}

			if (mask && (ingredientsChanged || getValueChanged || setValueChanged)) {
				pushInitial();
			}
		},
		destroy() {
			node.removeEventListener('focus', onFocus);
			node.removeEventListener('blur', onBlur);
			detach();
		},
		// Handle methods are exposed as additional properties on the
		// action's return value, which Svelte's `use:` directive makes
		// available via the action handler. They are typed against
		// `DirectionMaskHandle` via the dedicated cast below.
		getMask: (() => {
			if (!mask) throw new Error('directionMask: mask not initialized');
			return mask;
		}) as DirectionMaskHandle['getMask'],
		getModel: (() => {
			if (!mask) throw new Error('directionMask: mask not initialized');
			return mask.masked as DirectionMasked;
		}) as DirectionMaskHandle['getModel'],
		syncFromProps: () => {
			pushInitial();
		}
	};
};
