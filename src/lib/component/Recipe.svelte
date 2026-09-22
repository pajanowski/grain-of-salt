<script lang="ts">
	import {
		EmptyIngredient,
		EmptyDirection,
		type Ingredient,
		type Direction
	} from '$lib/obj/Recipe.svelte';
	import type { IngredientChange, DirectionChange } from '$lib/obj/RecipeNode.svelte';
	import { v4 as uuid } from 'uuid';
	import { parseAmount } from '$lib/parseAmount';
	import IngredientRow from './IngredientRow.svelte';
	import DirectionRow from './DirectionRow.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import IngredientPicker from './IngredientPicker.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import NodeChanges from './NodeChanges.svelte';
	import Tabs from './Tabs.svelte';
	import NoteSidebar, { type SidebarChange } from './NoteSidebar.svelte';
	import SubstitutesPanel from './SubstitutesPanel.svelte';
	import UnitAutocomplete from './UnitAutocomplete.svelte';
	import {
		tokenizeMaskedBody,
		displayToRaw,
		rawToDisplay,
		type MaskedBody
	} from '$lib/obj/directionMask';
	import { normalizeUnit } from '$lib/unit';
	import { invalidateAll, goto, invalidate } from '$app/navigation';
	import { api, errorMessage } from '$lib/api';

	const { data } = $props();

	let recipe = $derived(data.recipe);
	let currentNode = $derived(data.currentNode);
	let rootNodeId = $derived(recipe.id);
	// Substitutes authored by any descendant of the current node.
	// See src/routes/mise/recipes/[slug]/+page.server.ts — the loader
	// resolves the descendant graph server-side and passes it in. The
	// component passes entries to row components (for the "Subs" chip)
	// and renders the slide-out sidebar with the matching entries.
	let descendantSubstitutesByRowId = $derived(data.descendantSubstitutes?.byRowId ?? {});

	// Selected row for the substitutes sidebar. `{ rowId, kind } | null`.
	// When set, the sidebar renders every descendant substitute that
	// targets this row.
	type SubstituteSelection = {
		rowId: string;
		kind: 'ingredient' | 'direction';
		rowLabel: string;
	};
	let openSubstitutesFor = $state<SubstituteSelection | null>(null);

	function closeSubstitutesSidebar() {
		openSubstitutesFor = null;
	}

	let leafIngredientChanges = $state<IngredientChange[]>([]);
	let leafDirectionChanges = $state<DirectionChange[]>([]);

	let syncedNodeId = $state<string | null>(null);
	$effect(() => {
		if (currentNode.id !== syncedNodeId) {
			leafIngredientChanges = JSON.parse(JSON.stringify(currentNode.ingredientChanges));
			leafDirectionChanges = JSON.parse(JSON.stringify(currentNode.directionChanges));
			syncedNodeId = currentNode.id;
		}
	});

	let displayedIngredients = $derived.by(() => {
		const map = new Map<string, Ingredient>();
		for (const ing of recipe.ingredients) map.set(ing.id, ing);
		for (const c of leafIngredientChanges) {
			if (c.changeType === 'add' && c.body) {
				if (c.targetId !== null) {
					// Reorder-only claim on an ancestor-originated row. Move
					// the row to the end of Map insertion order without
					// clobbering the body (the ancestor's value is already
					// in `map` from `recipe.ingredients`).
					if (map.has(c.body.id)) {
						const existing = map.get(c.body.id)!;
						map.delete(c.body.id);
						map.set(c.body.id, existing);
					}
				} else {
					// Fresh add / reclaim: leaf owns the body.
					if (map.has(c.body.id)) map.delete(c.body.id);
					map.set(c.body.id, c.body);
				}
			} else if (c.changeType === 'edit' && c.body && c.targetId) {
				map.set(c.targetId, c.body);
			} else if (c.changeType === 'remove' && c.targetId) {
				map.delete(c.targetId);
			}
		}
		return Array.from(map.values());
	});
	let displayedDirections = $derived.by(() => {
		const map = new Map<string, Direction>();
		for (const dir of recipe.directions) map.set(dir.id, dir);
		for (const c of leafDirectionChanges) {
			if (c.changeType === 'add' && c.body) {
				if (c.targetId !== null) {
					// See displayedIngredients above.
					if (map.has(c.body.id)) {
						const existing = map.get(c.body.id)!;
						map.delete(c.body.id);
						map.set(c.body.id, existing);
					}
				} else {
					if (map.has(c.body.id)) map.delete(c.body.id);
					map.set(c.body.id, c.body);
				}
			} else if (c.changeType === 'edit' && c.body && c.targetId) {
				map.set(c.targetId, c.body);
			} else if (c.changeType === 'remove' && c.targetId) {
				map.delete(c.targetId);
			}
		}
		return Array.from(map.values());
	});

	function leafRecordForIngredient(rowId: string): IngredientChange | undefined {
		return leafIngredientChanges.find(
			(c) =>
				(c.changeType === 'add' && c.body?.id === rowId) ||
				(c.changeType === 'edit' && c.targetId === rowId) ||
				(c.changeType === 'substitute' && c.targetId === rowId)
		);
	}
	function leafRecordForDirection(rowId: string): DirectionChange | undefined {
		return leafDirectionChanges.find(
			(c) =>
				(c.changeType === 'add' && c.body?.id === rowId) ||
				(c.changeType === 'edit' && c.targetId === rowId) ||
				(c.changeType === 'substitute' && c.targetId === rowId)
		);
	}
	// A row can only be substituted if the leaf hasn't already authored
	// an `add` (fresh row the leaf owns), `edit`, or `substitute` for it.
	// Substitute on top of an existing leaf change would either be
	// incoherent (subbing a row you just added) or redundant (subbing a
	// row you've already edited or subbed). Reorder-only `add` claims
	// (targetId !== null) are position assertions, not real changes, so
	// they don't block substitution.
	function canSubstituteIngredient(rowId: string): boolean {
		return !leafIngredientChanges.some(
			(c) =>
				(c.changeType === 'add' && c.body?.id === rowId) ||
				((c.changeType === 'edit' || c.changeType === 'substitute') && c.targetId === rowId)
		);
	}
	function canSubstituteDirection(rowId: string): boolean {
		return !leafDirectionChanges.some(
			(c) =>
				(c.changeType === 'add' && c.body?.id === rowId) ||
				((c.changeType === 'edit' || c.changeType === 'substitute') && c.targetId === rowId)
		);
	}

	function editIngredient(
		rowId: string,
		next: Ingredient,
		changeType: 'edit' | 'substitute' = 'edit'
	) {
		const record = leafRecordForIngredient(rowId);
		// 'substitute' is syntactic sugar over 'edit': same wire shape
		// (targetId + body), same materialize behavior; the changeType
		// label is the only thing that differs so the row gets the blue
		// SUB badge in NodeChanges and the graph.
		//
		// Reclaim only applies when the user picked Edit: editing a row
		// whose leaf owns it (a fresh `add`) updates the body in place.
		// For `substitute`, we always emit a new change so the row's
		// history carries an explicit "this was a substitution" record.
		if (
			changeType === 'edit' &&
			record &&
			record.body &&
			record.changeType === 'add' &&
			record.targetId === null
		) {
			// Reclaim: this row's leaf `add` owns the body (it was freshly
			// added or a previous edit rebuilt it). Update in place.
			record.body = { ...next };
		} else {
			leafIngredientChanges.push({
				id: uuid(),
				changeType,
				targetId: rowId,
				note: null,
				body: { ...next }
			});
		}
	}
	function removeIngredient(rowId: string) {
		const idx = leafIngredientChanges.findIndex(
			(c) =>
				(c.changeType === 'add' && c.body?.id === rowId) ||
				(c.changeType === 'edit' && c.targetId === rowId)
		);
		if (idx >= 0) {
			leafIngredientChanges.splice(idx, 1);
		} else {
			leafIngredientChanges.push({
				id: uuid(),
				changeType: 'remove',
				targetId: rowId,
				note: null,
				body: null
			});
		}
	}
	function moveIngredient(rowId: string, direction: 'up' | 'down') {
		const currentIdx = displayedIngredients.findIndex((i) => i.id === rowId);
		if (currentIdx < 0) return;
		const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
		if (targetIdx < 0 || targetIdx >= displayedIngredients.length) return;

		// Build the reordered visible list by swapping current and target.
		const reordered = [...displayedIngredients];
		[reordered[currentIdx], reordered[targetIdx]] = [reordered[targetIdx], reordered[currentIdx]];

		// Reorder `leafIngredientChanges` so the leaf's array order matches
		// the desired display order. Server applies `add`s in array order,
		// and apply's delete-then-set means a leaf-emitted `add` moves its
		// row to the end of the Map. So:
		//   - Rows the leaf has already touched keep their existing `add`
		//     record (UUID and body), preserving history.
		//   - Ancestor-originated rows get a fresh `add` placed at the
		//     desired position; on subsequent moves that record is reused.
		//   - Any non-`add` changes on the leaf (edit, remove) are preserved
		//     as-is at the end of the array — their row's display position
		//     is governed by the corresponding `add` record.
		const existingAddsByRowId = new Map<string, IngredientChange>();
		for (const c of leafIngredientChanges) {
			if (c.changeType === 'add' && c.body) existingAddsByRowId.set(c.body.id, c);
		}
		const nonAddChanges = leafIngredientChanges.filter((c) => c.changeType !== 'add');

		const reorderedAdds: IngredientChange[] = reordered.map((ing) => {
			const existing = existingAddsByRowId.get(ing.id);
			if (existing) return existing;
			// First time the leaf claims this row's position. Emit an
			// `add` with `targetId = rowId` so the server treats it as a
			// reorder-only claim: the row's body stays whatever the ancestor
			// supplied, only its position in the Map changes. A plain `add`
			// (targetId === null) would set the body to `ing` and clobber
			// later parent edits.
			return {
				id: uuid(),
				changeType: 'add',
				targetId: ing.id,
				note: null,
				body: { ...ing }
			};
		});

		leafIngredientChanges = [...reorderedAdds, ...nonAddChanges];
	}
	function addIngredient(input: Ingredient, note: string | null = null) {
		leafIngredientChanges.push({
			id: uuid(),
			changeType: 'add',
			targetId: null,
			note,
			body: { ...input }
		});
	}

	function editDirection(
		rowId: string,
		next: Direction,
		changeType: 'edit' | 'substitute' = 'edit'
	) {
		const record = leafRecordForDirection(rowId);
		// See editIngredient: 'substitute' is syntactic sugar over 'edit'.
		// Reclaim only applies to 'edit'; 'substitute' always emits a new
		// change so the row's history records the substitution.
		if (
			changeType === 'edit' &&
			record &&
			record.body &&
			record.changeType === 'add' &&
			record.targetId === null
		) {
			// See editIngredient: reclaim path.
			record.body = { ...next };
		} else {
			leafDirectionChanges.push({
				id: uuid(),
				changeType,
				targetId: rowId,
				note: null,
				body: { ...next }
			});
		}
	}
	function removeDirection(rowId: string) {
		const idx = leafDirectionChanges.findIndex(
			(c) =>
				(c.changeType === 'add' && c.body?.id === rowId) ||
				(c.changeType === 'edit' && c.targetId === rowId)
		);
		if (idx >= 0) {
			leafDirectionChanges.splice(idx, 1);
		} else {
			leafDirectionChanges.push({
				id: uuid(),
				changeType: 'remove',
				targetId: rowId,
				note: null,
				body: null
			});
		}
	}
	function moveDirection(rowId: string, direction: 'up' | 'down') {
		const currentIdx = displayedDirections.findIndex((d) => d.id === rowId);
		if (currentIdx < 0) return;
		const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
		if (targetIdx < 0 || targetIdx >= displayedDirections.length) return;

		const reordered = [...displayedDirections];
		[reordered[currentIdx], reordered[targetIdx]] = [reordered[targetIdx], reordered[currentIdx]];

		// See moveIngredient above for the rationale: reorder leaf-emitted
		// `add` records in place, preserve their UUIDs, and only emit a
		// fresh `add` for ancestor-originated rows that have not yet been
		// touched by the leaf.
		const existingAddsByRowId = new Map<string, DirectionChange>();
		for (const c of leafDirectionChanges) {
			if (c.changeType === 'add' && c.body) existingAddsByRowId.set(c.body.id, c);
		}
		const nonAddChanges = leafDirectionChanges.filter((c) => c.changeType !== 'add');

		const reorderedAdds: DirectionChange[] = reordered.map((dir) => {
			const existing = existingAddsByRowId.get(dir.id);
			if (existing) return existing;
			// See moveIngredient: emit a reorder-only `add` (targetId = rowId)
			// so the ancestor's body is not clobbered.
			return {
				id: uuid(),
				changeType: 'add',
				targetId: dir.id,
				note: null,
				body: { ...dir }
			};
		});

		leafDirectionChanges = [...reorderedAdds, ...nonAddChanges];
	}
	function addDirection(input: Direction, note: string | null = null) {
		leafDirectionChanges.push({
			id: uuid(),
			changeType: 'add',
			targetId: null,
			note,
			body: { ...input }
		});
	}

	let addingIngredient = $state(false);
	let addingDirection = $state(false);
	let amountError = $state<string | null>(null);
	let amountRaw = $state('');
	let newIngredient = $state(EmptyIngredient());
	let newDirection = $state(EmptyDirection());
	let addIngredientTab = $state<'details' | 'note'>('details');
	let addDirectionTab = $state<'details' | 'note'>('details');
	let addIngredientNote = $state('');
	let addDirectionNote = $state('');
	let addDirectionTextareaRef = $state<HTMLTextAreaElement | null>(null);
	let addDirectionPickerOpen = $state(false);
	let addDirectionPickerFilterText = $state('');

	// Masked view of the add-direction body. Always shown in the
	// textarea; raw `#<uuid>` edits are routed through the input
	// handler so chips act atomically.
	const addDirectionMasked = $derived<MaskedBody>(
		tokenizeMaskedBody(newDirection.body ?? '', displayedIngredients ?? [])
	);

	function doAddIngredient() {
		const amtResult = parseAmount(amountRaw);
		if (amtResult.error) {
			amountError = amtResult.error;
			return;
		}
		amountError = null;
		const trimmedNote = addIngredientNote.trim();
		const normalizedUnit = normalizeUnit(newIngredient.unit);
		addIngredient(
			{ ...newIngredient, amount: amtResult.value!, unit: normalizedUnit },
			trimmedNote.length > 0 ? trimmedNote : null
		);
		newIngredient = EmptyIngredient();
		amountRaw = '';
		addIngredientNote = '';
		addIngredientTab = 'details';
		requestAnimationFrame(() => {
			(document.querySelector('[data-add-ingredient-name]') as HTMLInputElement | null)?.focus();
		});
	}

	function doAddDirection() {
		const trimmedNote = addDirectionNote.trim();
		addDirection({ ...newDirection }, trimmedNote.length > 0 ? trimmedNote : null);
		newDirection = EmptyDirection();
		addDirectionNote = '';
		addDirectionTab = 'details';
		addDirectionPickerOpen = false;
		requestAnimationFrame(() => {
			(document.querySelector('[data-add-direction-body]') as HTMLTextAreaElement | null)?.focus();
		});
	}

	/**
	 * Canonical typing-`#`-and-pickup-popup handler for the add
	 * direction form. Mirrors the logic in `DirectionRow.svelte` so
	 * the editing and add-direction flows behave identically.
	 */
	function handleAddDirectionTextareaInput(e: Event) {
		const ta = e.target as HTMLTextAreaElement;
		detectAddDirectionPicker(ta);
		applyAddDirectionDisplayedEdit(ta);
	}

	function detectAddDirectionPicker(ta: HTMLTextAreaElement) {
		const pos = ta.selectionStart;
		const beforeCaret = ta.value.slice(0, pos);
		const matches = [...beforeCaret.matchAll(/\s/g)];
		const lastSpace = matches.length > 0 ? matches[matches.length - 1].index : -1;
		const tokenAfterSpace = beforeCaret.slice(lastSpace + 1);
		if (tokenAfterSpace.startsWith('#')) {
			addDirectionPickerOpen = true;
			addDirectionPickerFilterText = tokenAfterSpace.slice(1);
		} else {
			addDirectionPickerOpen = false;
			addDirectionPickerFilterText = '';
		}
	}

	function applyAddDirectionDisplayedEdit(ta: HTMLTextAreaElement) {
		const prevDisplay = addDirectionMasked.display;
		const nextDisplay = ta.value;
		if (prevDisplay === nextDisplay) return;

		const diff = computeEditDiff(prevDisplay, nextDisplay);
		if (!diff) {
			ta.value = addDirectionMasked.display;
			return;
		}

		const rawStart = displayToRaw(diff.start, addDirectionMasked);
		const rawEnd = displayToRaw(diff.end, addDirectionMasked);
		const head = newDirection.body.slice(0, rawStart);
		const tail = newDirection.body.slice(rawEnd);
		const insertedRaw = translateDisplayedInsertionToRaw(diff.inserted, displayedIngredients);
		newDirection.body = head + insertedRaw + tail;

		const newMasked = tokenizeMaskedBody(newDirection.body, displayedIngredients);
		ta.value = newMasked.display;
		const caretRaw = rawStart + insertedRaw.length;
		const caretDisplay = rawToDisplay(caretRaw, newMasked);
		ta.selectionStart = ta.selectionEnd = caretDisplay;
	}

	function translateDisplayedInsertionToRaw(text: string, ings: Ingredient[]): string {
		if (text === '') return '';
		const nameMap = new Map<string, Ingredient>();
		for (const ing of ings) nameMap.set(`#${ing.name}`, ing);
		return text.replace(/#[^\s]+/g, (tok) => {
			const ing = nameMap.get(tok);
			return ing ? `#${ing.id}` : tok;
		});
	}

	interface EditDiff {
		start: number;
		end: number;
		inserted: string;
	}

	function computeEditDiff(prev: string, next: string): EditDiff | null {
		if (prev === next) return null;
		let start = 0;
		const minLen = Math.min(prev.length, next.length);
		while (start < minLen && prev[start] === next[start]) start++;
		let endPrev = prev.length;
		let endNext = next.length;
		while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
			endPrev--;
			endNext--;
		}
		return {
			start,
			end: endPrev,
			inserted: next.slice(start, endNext)
		};
	}

	function findAddDirectionChipAtDisplay(
		m: MaskedBody,
		displayPos: number
	): MaskedBody['segments'][number] | null {
		for (const seg of m.segments) {
			if (seg.type !== 'chip') continue;
			if (displayPos >= seg.displayStart && displayPos < seg.displayEnd) return seg;
		}
		return null;
	}

	function findAddDirectionChipOverlapping(
		m: MaskedBody,
		start: number,
		end: number
	): MaskedBody['segments'][number] | null {
		for (const seg of m.segments) {
			if (seg.type !== 'chip') continue;
			if (start <= seg.displayEnd && end >= seg.displayStart) return seg;
		}
		return null;
	}

	/**
	 * Atomic deletion: any Backspace/Delete that touches a masked chip
	 * removes the entire underlying `#<uuid>` from `newDirection.body`.
	 */
	function handleAddDirectionKeydown(e: KeyboardEvent) {
		const ta = e.target as HTMLTextAreaElement;
		const start = ta.selectionStart ?? 0;
		const end = ta.selectionEnd ?? start;

		if (e.key === 'Backspace' || e.key === 'Delete') {
			const range =
				start !== end
					? { start, end }
					: e.key === 'Backspace'
						? { start: Math.max(0, start - 1), end }
						: { start, end: Math.min(ta.value.length, end + 1) };

			const chip = findAddDirectionChipOverlapping(addDirectionMasked, range.start, range.end);
			if (chip && chip.type === 'chip') {
				e.preventDefault();
				newDirection.body =
					newDirection.body.slice(0, chip.rawStart) + newDirection.body.slice(chip.rawEnd);
				const newMasked = tokenizeMaskedBody(newDirection.body, displayedIngredients);
				ta.value = newMasked.display;
				const caretDisplay = rawToDisplay(chip.rawStart, newMasked);
				ta.selectionStart = ta.selectionEnd = caretDisplay;
				return;
			}
		}
		if (e.key === 'Escape' && addDirectionPickerOpen) {
			addDirectionPickerOpen = false;
			e.preventDefault();
		}
	}

	function handleAddDirectionPickerPick(id: string) {
		if (!addDirectionTextareaRef) return;
		const ta = addDirectionTextareaRef;
		const pos = ta.selectionStart;
		const beforeCaret = ta.value.substring(0, pos);
		const hashIdx = beforeCaret.lastIndexOf('#');
		if (hashIdx < 0) return;

		const existing = findAddDirectionChipAtDisplay(addDirectionMasked, hashIdx);
		const insert = '#' + id;
		if (existing) {
			newDirection.body =
				newDirection.body.slice(0, existing.rawStart) +
				insert +
				newDirection.body.slice(existing.rawEnd);
		} else {
			const rawStart = displayToRaw(hashIdx, addDirectionMasked);
			// The token at the caret is `#<filter>`, extending from `hashIdx`
			// to the next whitespace in the displayed textarea (or end of
			// value if there is none). Map that end boundary back into the
			// raw body so the splice removes the typed filter text too.
			const trailingText = ta.value.substring(hashIdx);
			const wsIdx = trailingText.search(/\s/);
			const tokenEnd = wsIdx < 0 ? ta.value.length : hashIdx + wsIdx;
			const rawEnd = displayToRaw(tokenEnd, addDirectionMasked);
			const head = newDirection.body.slice(0, rawStart);
			const tail = newDirection.body.slice(rawEnd);
			newDirection.body = head + insert + tail;
			if (tail.length > 0 && !/\s/.test(tail[0])) {
				newDirection.body += ' ';
			}
		}
		const newMasked = tokenizeMaskedBody(newDirection.body, displayedIngredients);
		ta.value = newMasked.display;
		addDirectionPickerOpen = false;
		const insertedRawEnd =
			(existing?.rawStart ?? displayToRaw(hashIdx, addDirectionMasked)) + insert.length;
		const caretDisplay = rawToDisplay(insertedRawEnd, newMasked);
		ta.selectionStart = ta.selectionEnd = caretDisplay;
	}

	function ingredientNoteFor(rowId: string): string | null {
		const c = leafIngredientChanges.find(
			(x) =>
				(x.changeType === 'add' && x.body?.id === rowId) ||
				((x.changeType === 'edit' || x.changeType === 'remove') && x.targetId === rowId)
		);
		return c?.note ?? null;
	}

	function directionNoteFor(rowId: string): string | null {
		const c = leafDirectionChanges.find(
			(x) =>
				(x.changeType === 'add' && x.body?.id === rowId) ||
				((x.changeType === 'edit' || x.changeType === 'remove') && x.targetId === rowId)
		);
		return c?.note ?? null;
	}

	let openRowNoteEditor = $state<{
		change: SidebarChange;
		kind: 'ingredient' | 'direction';
		changeId: string;
		currentNote: string | null;
	} | null>(null);

	function openRowNote(rowId: string, kind: 'ingredient' | 'direction') {
		const arr = kind === 'ingredient' ? leafIngredientChanges : leafDirectionChanges;
		const c = arr.find(
			(x) =>
				(x.changeType === 'add' && x.body?.id === rowId) ||
				((x.changeType === 'edit' || x.changeType === 'remove') && x.targetId === rowId)
		);
		if (!c) return;
		openRowNoteEditor = {
			change: {
				id: c.id,
				kind,
				changeType: c.changeType,
				text:
					kind === 'ingredient'
						? formatIngredient(c.body, c.changeType)
						: formatDirection(c.body, c.changeType)
			},
			kind,
			changeId: c.id,
			currentNote: c.note ?? null
		};
	}

	function closeRowNote() {
		openRowNoteEditor = null;
	}

	function commitRowNote(text: string) {
		if (!openRowNoteEditor) return;
		const { kind, changeId } = openRowNoteEditor;
		const arr = kind === 'ingredient' ? leafIngredientChanges : leafDirectionChanges;
		const c = arr.find((x) => x.id === changeId);
		if (c) c.note = text.length > 0 ? text : null;
	}

	/**
	 * Set the note on the leaf change that owns a given row id, looking
	 * up by either the change's `targetId` (edit/remove) or its body id
	 * (add). Used by the row's edit-form Note tab.
	 */
	function setRowNote(rowId: string, kind: 'ingredient' | 'direction', note: string | null) {
		const arr = kind === 'ingredient' ? leafIngredientChanges : leafDirectionChanges;
		const c = arr.find(
			(x) =>
				(x.changeType === 'add' && x.body?.id === rowId) ||
				((x.changeType === 'edit' || x.changeType === 'remove') && x.targetId === rowId)
		);
		if (c) c.note = note;
	}

	function deleteRowNote() {
		if (!openRowNoteEditor) return;
		const { kind, changeId } = openRowNoteEditor;
		const arr = kind === 'ingredient' ? leafIngredientChanges : leafDirectionChanges;
		const c = arr.find((x) => x.id === changeId);
		if (c) c.note = null;
	}

	function formatIngredient(body: unknown, op: 'add' | 'edit' | 'remove' | 'substitute'): string {
		if (op === 'remove') return 'ingredient';
		if (!body || typeof body !== 'object') return 'ingredient';
		const ing = body as { name?: string; amount?: number; unit?: string };
		const parts = [ing.name ?? ''];
		if (ing.amount) parts.push(String(ing.amount));
		if (ing.unit) parts.push(ing.unit);
		return parts.filter(Boolean).join(' ').trim() || 'ingredient';
	}

	function formatDirection(body: unknown, op: 'add' | 'edit' | 'remove' | 'substitute'): string {
		if (op === 'remove') return 'direction';
		if (!body || typeof body !== 'object') return 'direction';
		const dir = body as { body?: string };
		return dir.body || '(empty)';
	}

	function snapshotKey(
		changes: { id: string; changeType: string; body: unknown; note: string | null }[]
	): string {
		return JSON.stringify(
			[...changes]
				.map((c) => ({ id: c.id, changeType: c.changeType, body: c.body, note: c.note }))
				.sort((a, b) => a.id.localeCompare(b.id))
		);
	}

	let hasUnsavedChanges = $derived(
		snapshotKey(leafIngredientChanges) !== snapshotKey(currentNode.ingredientChanges) ||
			snapshotKey(leafDirectionChanges) !== snapshotKey(currentNode.directionChanges)
	);

	function performSave() {
		if (!hasUnsavedChanges) return;
		api
			.put(`/mise/api/recipe-node/${currentNode.id}`, {
				nodeId: currentNode.id,
				ingredientChanges: leafIngredientChanges,
				directionChanges: leafDirectionChanges
			})
			.then(async () => {
				await invalidateAll();
				syncedNodeId = null;
			})
			.catch((e) => {
				alert(`Save failed: ${errorMessage(e)}`);
			});
	}

	function performReset() {
		leafIngredientChanges = JSON.parse(JSON.stringify(currentNode.ingredientChanges));
		leafDirectionChanges = JSON.parse(JSON.stringify(currentNode.directionChanges));
	}

	let showRenameModal = $state(false);
	let renameName = $state('');
	let renameBusy = $state(false);

	function openRename() {
		renameName = recipe.name;
		showRenameModal = true;
	}

	async function confirmRename() {
		const trimmed = renameName.trim();
		if (!trimmed || renameBusy) return;
		renameBusy = true;
		try {
			await api.patch(`/mise/api/recipe/${rootNodeId}`, { name: trimmed });
			await invalidate('app:recipe-tree');
			showRenameModal = false;
		} catch (e) {
			alert(`Rename failed: ${errorMessage(e)}`);
		} finally {
			renameBusy = false;
		}
	}

	let showForkModal = $state(false);
	let forkName = $state('');
	let forkBusy = $state(false);

	function openFork() {
		forkName = recipe.name + ' (fork)';
		showForkModal = true;
	}

	async function confirmFork() {
		const trimmed = forkName.trim();
		if (!trimmed || forkBusy) return;
		forkBusy = true;
		try {
			const { data: newRecipe } = await api.post<{ id: string }>(
				`/mise/api/recipe/${currentNode.id}/fork`,
				{ name: trimmed }
			);
			showForkModal = false;
			await invalidate('app:recipe-tree');
			await goto(`/mise/recipes/${newRecipe.id}`);
		} catch (e) {
			alert(`Fork failed: ${errorMessage(e)}`);
		} finally {
			forkBusy = false;
		}
	}

	async function confirmDelete() {
		if (!confirm(`Delete "${recipe.name}"? This cannot be undone.`)) return;
		const res = await fetch(`/mise/api/recipe/${rootNodeId}`, { method: 'DELETE' });
		if (!res.ok) {
			alert(`Delete failed: ${res.status} ${res.statusText}`);
			return;
		}
		await invalidate('app:recipe-tree');
		await goto('/mise');
	}

	let shareLinkCopied = $state(false);
	async function togglePublic() {
		const next = !currentNode.isPublic;
		try {
			await api.patch(`/mise/api/recipe-node/${currentNode.id}/public`, {
				isPublic: next
			});
			await invalidateAll();
		} catch (e) {
			alert(`Failed to update visibility: ${errorMessage(e)}`);
		}
	}
	async function toggleFavorite() {
		try {
			await api.patch(`/mise/api/recipe-node/${currentNode.id}/favorite`);
			await invalidateAll();
		} catch (e) {
			alert(`Failed to update favorite: ${errorMessage(e)}`);
		}
	}
	async function copyShareLink() {
		const url = `${window.location.origin}/recipe/${currentNode.id}`;
		await navigator.clipboard.writeText(url);
		shareLinkCopied = true;
		setTimeout(() => (shareLinkCopied = false), 2000);
	}

	const menuItems: MenuItem[] = $derived([
		{ label: 'Rename recipe', onSelect: openRename },
		{ label: 'Fork recipe', onSelect: openFork },
		{ label: currentNode.isPublic ? 'Make private' : 'Make public', onSelect: togglePublic },
		{
			label: currentNode.isFavorite ? 'Unfavorite' : 'Favorite',
			onSelect: toggleFavorite
		},
		{ label: 'Delete recipe', onSelect: confirmDelete, danger: true }
	]);
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-6">
	<!-- Recipe header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="flex items-center gap-2 text-2xl font-bold">
				{#if data.currentNode.isFavorite}
					<svg
						data-testid="recipe-favorite-star"
						aria-label="Favorite"
						class="h-5 w-5 fill-amber-400 stroke-amber-500"
						viewBox="0 0 24 24"
						fill="currentColor"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polygon
							points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
						/>
					</svg>
				{/if}
				{recipe.name}
			</h1>
			{#if data.currentNode.author}
				<p class="text-sm text-stone-500">by {data.currentNode.author}</p>
			{/if}
			{#if data.currentNode.source}
				<p class="text-sm text-stone-400">via {data.currentNode.source}</p>
			{/if}
			{#if data.currentNode.isPublic}
				<p class="mt-1 flex items-center gap-1.5 text-xs text-stone-400">
					<a
						href="/recipe/{data.currentNode.id}"
						target="_blank"
						rel="noopener noreferrer"
						class="underline hover:text-stone-600"
					>
						/recipe/{data.currentNode.id}
					</a>
					<button
						type="button"
						class="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-xs hover:bg-stone-100"
						onclick={copyShareLink}
					>
						{shareLinkCopied ? 'Copied!' : 'Copy'}
					</button>
				</p>
			{/if}
		</div>
		<ContextMenu items={menuItems} label="Recipe actions" />
	</div>

	<!-- Ingredients -->
	<section class="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-stone-100 px-4 py-3">
			<h2 class="font-semibold text-stone-800">Ingredients</h2>
			<button
				class="btn-amber secondary flex items-center gap-1.5 text-sm"
				onclick={() => {
					if (!addingIngredient) {
						newIngredient = EmptyIngredient();
						amountRaw = '';
						amountError = null;
						addIngredientNote = '';
						addIngredientTab = 'details';
					}
					addingIngredient = !addingIngredient;
					if (addingIngredient) {
						requestAnimationFrame(() => {
							(
								document.querySelector('[data-add-ingredient-name]') as HTMLInputElement | null
							)?.focus();
						});
					}
				}}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-4 w-4"
					aria-hidden="true"
				>
					<line x1="12" x2="12" y1="5" y2="19" />
					<line x1="5" x2="19" y1="12" y2="12" />
				</svg>
				Add
			</button>
		</div>

		<div class="p-4">
			<ol class="flex flex-col divide-y divide-stone-100" data-testid="ingredient-list">
				{#each displayedIngredients as ing, i (ing.id)}
					<li class="py-3 first:pt-0 last:pb-0">
						<IngredientRow
							ingredient={ing}
							index={i}
							total={displayedIngredients.length}
							note={ingredientNoteFor(ing.id)}
							onNote={() => openRowNote(ing.id, 'ingredient')}
							onUpdate={(next) => editIngredient(ing.id, next)}
							onSubstitute={(next) => editIngredient(ing.id, next, 'substitute')}
							canSubstitute={canSubstituteIngredient(ing.id)}
							onUpdateNote={(note) => setRowNote(ing.id, 'ingredient', note)}
							onRemove={() => removeIngredient(ing.id)}
							onMove={(dir) => moveIngredient(ing.id, dir)}
							descendantSubstitutes={descendantSubstitutesByRowId[ing.id] ?? null}
							onOpenSubstitutes={() =>
								(openSubstitutesFor = {
									rowId: ing.id,
									kind: 'ingredient',
									rowLabel: `${ing.amount ?? ''} ${ing.unit ?? ''} ${ing.name}`.trim()
								})}
						/>
					</li>
				{/each}
			</ol>

			{#if addingIngredient}
				<form
					class="mt-3 flex flex-col gap-2 rounded border border-stone-200 bg-stone-50 p-3"
					onkeydown={(e) => {
						if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
							e.preventDefault();
							doAddIngredient();
						}
					}}
				>
					<Tabs
						tabs={[
							{ id: 'details', label: 'Details' },
							{ id: 'note', label: addIngredientNote.length > 0 ? 'Note ●' : 'Note' }
						]}
						selected={addIngredientTab}
						onchange={(id) => (addIngredientTab = id)}
					/>
					{#if addIngredientTab === 'details'}
						<input
							class="border rounded px-3 py-2"
							placeholder="Ingredient name"
							aria-label="Ingredient name"
							data-add-ingredient-name
							bind:value={newIngredient.name}
						/>
						<div class="flex gap-2">
							<input
								class="border rounded px-3 py-2 w-24"
								placeholder="Amount (e.g. 1/3, 1 1/2)"
								type="text"
								inputmode="numeric"
								bind:value={amountRaw}
							/>
							<UnitAutocomplete
								value={newIngredient.unit}
								onchange={(u) => (newIngredient.unit = u)}
							/>
						</div>
						{#if amountError}
							<p class="text-sm text-red-600">{amountError}</p>
						{/if}
					{:else}
						<textarea
							class="border rounded px-3 py-2 text-sm w-full"
							rows="3"
							placeholder="Optional note for this ingredient…"
							aria-label="Note"
							bind:value={addIngredientNote}></textarea>
					{/if}
					<div class="flex gap-2">
						<button class="btn-amber" onclick={doAddIngredient}>Add</button>
						<button
							type="button"
							class="btn-amber secondary"
							onclick={() => (addingIngredient = false)}>Cancel</button
						>
					</div>
				</form>
			{/if}
		</div>
	</section>

	<!-- Directions -->
	<section class="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-stone-100 px-4 py-3">
			<h2 class="font-semibold text-stone-800">Directions</h2>
			<button
				class="btn-amber secondary flex items-center gap-1.5 text-sm"
				onclick={() => {
					if (!addingDirection) {
						newDirection = EmptyDirection();
						addDirectionNote = '';
						addDirectionTab = 'details';
					}
					addingDirection = !addingDirection;
					if (addingDirection) {
						requestAnimationFrame(() => {
							(
								document.querySelector('[data-add-direction-body]') as HTMLTextAreaElement | null
							)?.focus();
						});
					}
				}}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-4 w-4"
					aria-hidden="true"
				>
					<line x1="12" x2="12" y1="5" y2="19" />
					<line x1="5" x2="19" y1="12" y2="12" />
				</svg>
				Add
			</button>
		</div>

		<div class="p-4">
			<ol class="flex flex-col divide-y divide-stone-100" data-testid="direction-list">
				{#each displayedDirections as dir, i (dir.id)}
					<li class="py-3 first:pt-0 last:pb-0">
						<DirectionRow
							direction={dir}
							index={i}
							total={displayedDirections.length}
							note={directionNoteFor(dir.id)}
							onNote={() => openRowNote(dir.id, 'direction')}
							onUpdate={(next) => editDirection(dir.id, next)}
							onSubstitute={(next) => editDirection(dir.id, next, 'substitute')}
							canSubstitute={canSubstituteDirection(dir.id)}
							onUpdateNote={(note) => setRowNote(dir.id, 'direction', note)}
							onRemove={() => removeDirection(dir.id)}
							onMove={(moveDir) => moveDirection(dir.id, moveDir)}
							ingredients={displayedIngredients}
							descendantSubstitutes={descendantSubstitutesByRowId[dir.id] ?? null}
							onOpenSubstitutes={() =>
								(openSubstitutesFor = {
									rowId: dir.id,
									kind: 'direction',
									rowLabel: dir.body
								})}
						/>
					</li>
				{/each}
			</ol>

			{#if addingDirection}
				<form
					class="mt-3 flex flex-col gap-2 rounded border border-stone-200 bg-stone-50 p-3"
					onkeydown={(e) => {
						if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
							e.preventDefault();
							doAddDirection();
						}
					}}
				>
					<Tabs
						tabs={[
							{ id: 'details', label: 'Details' },
							{ id: 'note', label: addDirectionNote.length > 0 ? 'Note ●' : 'Note' }
						]}
						selected={addDirectionTab}
						onchange={(id) => (addDirectionTab = id)}
					/>
					{#if addDirectionTab === 'details'}
						<textarea
							class="border rounded px-3 py-2 w-full"
							rows="3"
							placeholder="Direction"
							aria-label="Direction"
							data-add-direction-body
							bind:this={addDirectionTextareaRef}
							value={addDirectionMasked.display}
							oninput={handleAddDirectionTextareaInput}
							onkeydown={handleAddDirectionKeydown}></textarea>
						{#if addDirectionPickerOpen}
							<IngredientPicker
								ingredients={displayedIngredients}
								onPick={handleAddDirectionPickerPick}
								onClose={() => (addDirectionPickerOpen = false)}
								open={addDirectionPickerOpen}
								filterText={addDirectionPickerFilterText}
								textareaRef={addDirectionTextareaRef}
							/>
						{/if}
					{:else}
						<textarea
							class="border rounded px-3 py-2 text-sm w-full"
							rows="3"
							placeholder="Optional note for this direction…"
							aria-label="Note"
							bind:value={addDirectionNote}></textarea>
					{/if}
					<div class="flex gap-2">
						<button class="btn-amber" onclick={doAddDirection}>Add</button>
						<button
							type="button"
							class="btn-amber secondary"
							onclick={() => (addingDirection = false)}>Cancel</button
						>
					</div>
				</form>
			{/if}
		</div>
	</section>

	<!-- Unsaved changes bar -->
	{#if hasUnsavedChanges}
		<div
			class="sticky bottom-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-md"
		>
			<span class="text-sm font-medium text-amber-900">Unsaved changes</span>
			<div class="flex gap-2">
				<button type="button" class="btn-amber secondary" onclick={performReset}>Reset</button>
				<button type="button" class="btn-amber" onclick={performSave}>Save</button>
			</div>
		</div>
	{/if}

	<NodeChanges
		{leafIngredientChanges}
		{leafDirectionChanges}
		savedIngredientChanges={currentNode.ingredientChanges}
		savedDirectionChanges={currentNode.directionChanges}
		onRemoveIngredient={(id) => {
			const idx = leafIngredientChanges.findIndex((c) => c.id === id);
			if (idx >= 0) leafIngredientChanges.splice(idx, 1);
		}}
		onRemoveDirection={(id) => {
			const idx = leafDirectionChanges.findIndex((c) => c.id === id);
			if (idx >= 0) leafDirectionChanges.splice(idx, 1);
		}}
		onSetNote={(kind, id, note) => {
			const arr = kind === 'ingredient' ? leafIngredientChanges : leafDirectionChanges;
			const change = arr.find((c) => c.id === id);
			if (change) change.note = note;
		}}
	/>
</div>

<Dialog.Root bind:open={showRenameModal}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Rename recipe</Dialog.Title>
		</Dialog.Header>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				confirmRename();
			}}
		>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">New name</span>
				<input bind:value={renameName} aria-label="New recipe name" />
			</label>
			<Dialog.Footer>
				<Button type="submit" disabled={renameBusy}>{renameBusy ? 'Saving…' : 'Save'}</Button>
				<Button
					type="button"
					variant="outline"
					onclick={() => (showRenameModal = false)}>Cancel</Button
				>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={showForkModal}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Fork recipe</Dialog.Title>
		</Dialog.Header>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				confirmFork();
			}}
		>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">Fork name</span>
				<input bind:value={forkName} aria-label="Forked recipe name" />
			</label>
			<Dialog.Footer>
				<Button type="submit" disabled={forkBusy}>{forkBusy ? 'Forking…' : 'Fork'}</Button>
				<Button
					type="button"
					variant="outline"
					onclick={() => (showForkModal = false)}>Cancel</Button
				>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<NoteSidebar
	note={openRowNoteEditor}
	onclose={closeRowNote}
	onsave={commitRowNote}
	ondelete={deleteRowNote}
/>

<SubstitutesPanel
	selection={openSubstitutesFor}
	byRowId={descendantSubstitutesByRowId}
	onclose={closeSubstitutesSidebar}
/>
