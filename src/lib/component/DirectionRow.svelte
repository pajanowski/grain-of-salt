<script lang="ts">
	import type { Direction, Ingredient } from '$lib/obj/Recipe.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import Tabs from './Tabs.svelte';
	import NoteIcon from './NoteIcon.svelte';
	import DirectionBody from './DirectionBody.svelte';
	import IngredientPicker from './IngredientPicker.svelte';
	import {
		formatDirectionBody,
		tokenizeMaskedBody,
		displayToRaw,
		rawToDisplay,
		type MaskedBody
	} from '$lib/obj/directionMask';

	type Props = {
		direction: Direction;
		index: number;
		total: number;
		note: string | null;
		onNote: () => void;
		onUpdate: (next: Direction) => void;
		onUpdateNote: (note: string | null) => void;
		onRemove: () => void;
		onMove: (direction: 'up' | 'down') => void;
		readOnly?: boolean;
		ingredients?: Ingredient[];
	};

	let {
		direction,
		index,
		total,
		note,
		onNote,
		onUpdate,
		onUpdateNote,
		onRemove,
		onMove,
		readOnly = false,
		ingredients = []
	}: Props = $props();

	let editing = $state(false);
	let draft = $state<Direction>({ ...direction });
	let editTab = $state<'details' | 'note'>('details');
	let noteDraft = $state('');
	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let pickerOpen = $state(false);
	let pickerFilterText = $state('');

	// Tokenize the masked view of the current body. Recomputed on every
	// change to `draft.body` or `ingredients`. Used by all the edit
	// handlers below to translate display-position caret moves back to
	// raw-body edits.
	const masked = $derived<MaskedBody>(tokenizeMaskedBody(draft.body ?? '', ingredients ?? []));

	function startEdit() {
		draft = { ...direction };
		noteDraft = note ?? '';
		editTab = 'details';
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		pickerOpen = false;
	}

	function doEdit() {
		onUpdate({ ...draft });
		const trimmedNote = noteDraft.trim();
		onUpdateNote(trimmedNote.length > 0 ? trimmedNote : null);
		editing = false;
		pickerOpen = false;
	}

	function confirmRemove() {
		if (window.confirm(`Remove this direction?`)) {
			onRemove();
		}
	}

	/** Reset the textarea DOM to match the masked view of `draft.body`. */
	function syncTextareaToMasked() {
		if (!textareaRef) return;
		const desired = masked.display;
		if (textareaRef.value !== desired) textareaRef.value = desired;
	}

	/**
	 * Detect whether `selectionStart..selectionEnd` lies inside (or at
	 * the edge of) any chip segment of the current masked body. Returns
	 * the chip segment if so, otherwise null.
	 */
	function chipAtCaret(start: number, end: number): ReturnType<typeof findChipOverlapping> {
		return findChipOverlapping(masked, start, end);
	}

	// Find chip segment containing or directly touching the given range.
	function findChipOverlapping(
		m: MaskedBody,
		start: number,
		end: number
	): MaskedBody['segments'][number] | null {
		for (const seg of m.segments) {
			if (seg.type !== 'chip') continue;
			// Chip is "touched" if the deletion range overlaps or sits
			// right at the boundary.
			if (start <= seg.displayEnd && end >= seg.displayStart) return seg;
		}
		return null;
	}

	/**
	 * Canonical typing-`#`-and-pickup-popup handler (mirrors the
	 * `handleAddDirectionTextareaInput` logic in `Recipe.svelte`).
	 *
	 * The masked textarea always shows `#<Name>` references, so the
	 * space-prefix detector runs on the displayed text. Picking an
	 * option rewrites the underlying raw `#<uuid>` so the chosen
	 * ingredient persists; the masked view is re-derived from the raw
	 * body automatically.
	 */
	function handleTextareaInput(e: Event) {
		const ta = e.target as HTMLTextAreaElement;
		const pos = ta.selectionStart;
		const beforeCaret = ta.value.slice(0, pos);

		// Find the start of the token immediately before the caret:
		// the position right after the last whitespace.
		const matches = [...beforeCaret.matchAll(/\s/g)];
		const lastSpace = matches.length > 0 ? matches[matches.length - 1].index : -1;
		const tokenAfterSpace = beforeCaret.slice(lastSpace + 1);

		if (tokenAfterSpace.startsWith('#')) {
			pickerOpen = true;
			pickerFilterText = tokenAfterSpace.slice(1);
		} else {
			pickerOpen = false;
			pickerFilterText = '';
		}

		// Translate the displayed edit back to a raw-body edit. The
		// browser's native `input` event doesn't know about chips, so
		// we treat the new `ta.value` as the new masked display and
		// derive a raw body that produces it (best-effort:
		// `displayToRaw` for the caret and chip-aware substitution for
		// chip-text identity).
		applyDisplayedEdit(ta);
	}

	/**
	 * Translate the textarea's current `value` (masked text) into a new
	 * `draft.body` (raw `#<uuid>` text).
	 *
	 * Strategy: walk through the previous masked state and the new
	 * `ta.value`; identify what changed (insertions / deletions /
	 * replacements) and apply equivalent edits to the raw body.
	 *
	 * For v1 simplicity this treats user edits as **whole-string
	 * replacements**: it diffs the prior and new masked strings to find
	 * a single insertion or deletion range and applies the same range
	 * to the raw body via the tokenized segment offsets. Multi-edit
	 * pastes (e.g. via clipboard) just collapse to a wholesale
	 * replacement, which is acceptable for an authoring surface.
	 */
	function applyDisplayedEdit(ta: HTMLTextAreaElement) {
		const prevDisplay = masked.display;
		const nextDisplay = ta.value;
		if (prevDisplay === nextDisplay) return;

		const diff = computeEditDiff(prevDisplay, nextDisplay);
		if (!diff) {
			// Couldn't make sense of the change; revert to the
			// canonical masked view and give up.
			ta.value = masked.display;
			return;
		}

		const rawStart = displayToRaw(diff.start, masked);
		const rawEnd = displayToRaw(diff.end, masked);

		const head = draft.body.slice(0, rawStart);
		const tail = draft.body.slice(rawEnd);
		const insertedRaw = awaitDisplayedEditToRaw(diff.inserted, masked);
		draft.body = head + insertedRaw + tail;

		// After rebuilding, the masked view may have shifted because
		// the new `#<Name>` token resolves to a different
		// length than the original `#uuid`. Re-sync the textarea to
		// the new masked view and place the caret at the end of the
		// inserted range.
		const newMasked = tokenizeMaskedBody(draft.body, ingredients);
		ta.value = newMasked.display;
		const caretRaw = rawStart + insertedRaw.length;
		const caretDisplay = rawToDisplay(caretRaw, newMasked);
		ta.selectionStart = ta.selectionEnd = caretDisplay;
	}

	function awaitDisplayedEditToRaw(text: string, m: MaskedBody): string {
		// For inserted text, we attempt to reverse-resolve any
		// `#<Name>`-shaped token to its canonical `#<uuid>` if a known
		// ingredient with that name+amount+unit exists. If not, the
		// inserted characters are kept verbatim (uuid-shaped tokens
		// pass through unchanged; arbitrary text passes through).
		if (text === '') return '';
		const ingredientMap = new Map(ingredients.map((i) => [i.id.toLowerCase(), i]));
		// Build a quick name lookup: display `#Name` -> ingredient.
		const nameMap = new Map<string, Ingredient>();
		for (const ing of ingredientMap.values()) {
			nameMap.set(`#${ing.name}`, ing);
		}
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

	/**
	 * Diff two strings to find the smallest `[start, end)` range where
	 * `prev` differs from `next`. `inserted` is the replacement text.
	 * This collapses multi-region edits to a single change — good
	 * enough for typing/backspace in a textarea.
	 */
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

	/**
	 * Atomic deletion: Backspace / Delete that touches any part of a
	 * masked chip removes the underlying `#<uuid>` from `draft.body`.
	 *
	 * The browser's default behaviour would only remove one character
	 * of the masked text (e.g. just `S` from `#Sugar`). We intercept
	 * the keypress, walk the masked segments, and delete the entire
	 * chip when the caret / selection touches it.
	 */
	function handleTextareaKeydown(e: KeyboardEvent) {
		const ta = e.target as HTMLTextAreaElement;
		const start = ta.selectionStart ?? 0;
		const end = ta.selectionEnd ?? start;

		if (e.key === 'Backspace' || e.key === 'Delete') {
			// Determine the "expanded" range the user is effectively
			// deleting — backspace removes one char before the caret
			// (or the entire selection); delete removes one char after
			// (or the entire selection).
			const range =
				start !== end
					? { start, end }
					: e.key === 'Backspace'
						? { start: Math.max(0, start - 1), end }
						: { start, end: Math.min(ta.value.length, end + 1) };

			const chip = chipAtCaret(range.start, range.end);
			if (chip && chip.type === 'chip') {
				e.preventDefault();
				draft.body = draft.body.slice(0, chip.rawStart) + draft.body.slice(chip.rawEnd);
				const newMasked = tokenizeMaskedBody(draft.body, ingredients);
				ta.value = newMasked.display;
				const caretDisplay = rawToDisplay(chip.rawStart, newMasked);
				ta.selectionStart = ta.selectionEnd = caretDisplay;
				return;
			}
		}
		if (e.key === 'Escape' && pickerOpen) {
			pickerOpen = false;
			e.preventDefault();
		}
	}

	/**
	 * Insert the picked ingredient's uuid at the trailing `#<prefix>`
	 * token. Works against the masked text — find the `lastIndexOf('#')`
	 * before the caret, replace through the caret with `#<uuid>`.
	 */
	function handlePickerPick(id: string) {
		if (!textareaRef) return;
		const ta = textareaRef;
		const pos = ta.selectionStart;
		const value = ta.value;
		const beforeCaret = value.substring(0, pos);
		const hashIdx = beforeCaret.lastIndexOf('#');
		if (hashIdx < 0) return;

		// If the `#<prefix>` in the masked text is actually a chip
		// whose name exactly matches an existing ingredient, the user
		// is re-picking that chip: delete it first so the picked
		// ingredient replaces the existing one (rather than
		// duplicating the slot).
		const existing = findChipAtDisplay(masked, hashIdx);
		const insert = '#' + id;

		if (existing) {
			draft.body =
				draft.body.slice(0, existing.rawStart) + insert + draft.body.slice(existing.rawEnd);
		} else {
			// Plain text prefix — splice a new `#<uuid>` token in. The
			// token at the caret is `#<filter>`, extending from `hashIdx`
			// to the next whitespace in the displayed textarea (or end of
			// value if there is none). Map both boundaries back into the
			// raw body so the splice removes the typed filter text too.
			const rawStart = displayToRaw(hashIdx, masked);
			const trailingText = value.substring(hashIdx);
			const wsIdx = trailingText.search(/\s/);
			const tokenEnd = wsIdx < 0 ? value.length : hashIdx + wsIdx;
			const rawEnd = displayToRaw(tokenEnd, masked);
			const head = draft.body.slice(0, rawStart);
			const tail = draft.body.slice(rawEnd);
			draft.body = head + insert + tail;
			if (tail.length > 0 && !/\s/.test(tail[0])) {
				draft.body += ' ';
			}
		}
		const newMasked = tokenizeMaskedBody(draft.body, ingredients);
		ta.value = newMasked.display;
		pickerOpen = false;

		// Caret right after the freshly inserted token.
		const insertedRawEnd = (existing?.rawStart ?? displayToRaw(hashIdx, masked)) + insert.length;
		const caretDisplay = rawToDisplay(insertedRawEnd, newMasked);
		ta.selectionStart = ta.selectionEnd = caretDisplay;
	}

	function findChipAtDisplay(
		m: MaskedBody,
		displayPos: number
	): MaskedBody['segments'][number] | null {
		for (const seg of m.segments) {
			if (seg.type !== 'chip') continue;
			if (displayPos >= seg.displayStart && displayPos < seg.displayEnd) return seg;
		}
		return null;
	}

	// Re-render the textarea whenever the underlying body changes from
	// somewhere other than the keystroke path (e.g. parent prop
	// change). Without this, programmatic edits land in `draft.body`
	// but never reach the DOM until the next focus/blur.
	$effect(() => {
		if (textareaRef && document.activeElement !== textareaRef) {
			syncTextareaToMasked();
		}
	});

	// Focus the textarea when editing starts — avoids bind:this hydration issues
	$effect(() => {
		if (editing && editTab === 'details') {
			requestAnimationFrame(() => {
				(document.querySelector('[data-editing-direction]') as HTMLTextAreaElement | null)?.focus();
			});
		}
	});

	const items: MenuItem[] = $derived([
		{ label: 'Edit', onSelect: startEdit },
		{
			label: 'Move up',
			disabled: index === 0,
			onSelect: () => onMove('up')
		},
		{
			label: 'Move down',
			disabled: index === total - 1,
			onSelect: () => onMove('down')
		},
		{ label: 'Remove', onSelect: confirmRemove, danger: true }
	]);
</script>

<li class="flex items-start gap-2" data-testid="direction-row" data-direction-index={index}>
	{#if editing}
		<form
			class="flex flex-col gap-2 flex-1 rounded border border-stone-200 bg-stone-50 p-3"
			onkeydown={(e) => {
				if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
					e.preventDefault();
					doEdit();
				}
			}}
		>
			<Tabs
				tabs={[
					{ id: 'details', label: 'Details' },
					{ id: 'note', label: noteDraft.length > 0 ? 'Note ●' : 'Note' }
				]}
				selected={editTab}
				onchange={(id) => (editTab = id)}
			/>
			{#if editTab === 'details'}
				<textarea
					class="border rounded px-3 py-2 w-full"
					rows="3"
					placeholder="Direction"
					aria-label="Direction"
					data-editing-direction
					bind:this={textareaRef}
					value={masked.display}
					oninput={handleTextareaInput}
					onkeydown={handleTextareaKeydown}></textarea>
				{#if pickerOpen}
					<IngredientPicker
						{ingredients}
						onPick={handlePickerPick}
						onClose={() => (pickerOpen = false)}
						open={pickerOpen}
						filterText={pickerFilterText}
						{textareaRef}
					/>
				{/if}
			{:else}
				<textarea
					class="border rounded px-3 py-2 text-sm w-full"
					rows="3"
					placeholder="Optional note for this direction…"
					aria-label="Note"
					bind:value={noteDraft}></textarea>
			{/if}
			<div class="flex gap-2">
				<button type="button" class="btn-amber" onclick={doEdit}>Save</button>
				<button type="button" class="btn-amber secondary" onclick={cancelEdit}>Cancel</button>
			</div>
		</form>
	{:else}
		<div class="flex flex-col gap-1 flex-1 min-w-0">
			<div class="flex items-start gap-2">
				<span class="flex-1 flex items-start min-w-0">
					<span class="opacity-60 mr-2">{index + 1}.</span>
					<DirectionBody body={direction.body} {ingredients} />
				</span>
				{#if note && !readOnly}
					<button
						type="button"
						class="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 shrink-0"
						title={note}
						aria-label="Edit note"
						onclick={onNote}
						data-testid="direction-note-button"
					>
						<NoteIcon />
					</button>
				{/if}
			</div>
			{#if note && readOnly}
				<p class="flex items-center gap-1.5 text-sm text-stone-500 italic pl-5" title={note}>
					<NoteIcon />
					{note}
				</p>
			{/if}
		</div>
		{#if !readOnly}
			<ContextMenu {items} label={`Actions for direction ${index + 1}`} />
		{/if}
	{/if}
</li>
