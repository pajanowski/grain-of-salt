<script lang="ts">
	import type { Direction, Ingredient } from '$lib/obj/Recipe.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import Tabs from './Tabs.svelte';
	import NoteIcon from './NoteIcon.svelte';
	import { compileDirection } from '$lib/obj/directionCompile';
	import DirectionBody from './DirectionBody.svelte';
	import IngredientPicker from './IngredientPicker.svelte';

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
	let overlayRef = $state<HTMLDivElement | null>(null);
	let pickerOpen = $state(false);
	let textareaFocused = $state(false);
	let pickerFilterText = $state('');

	// Derived compiled tokens for the overlay
	const compiled = $derived(compileDirection(draft.body, ingredients));

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

	function handleTextareaInput(e: Event) {
		const ta = e.target as HTMLTextAreaElement;
		const match = ta.value.match(/#(?:[^\s]*)$/);
		if (match) {
			pickerOpen = true;
			// Extract filter text after the last #
			const pos = ta.selectionStart;
			const beforeCaret = ta.value.substring(0, pos);
			const hashIdx = beforeCaret.lastIndexOf('#');
			pickerFilterText = hashIdx >= 0 ? beforeCaret.substring(hashIdx + 1) : '';
		} else {
			pickerOpen = false;
			pickerFilterText = '';
		}
	}

	function handleTextareaKeydown(e: KeyboardEvent) {
		const ta = e.target as HTMLTextAreaElement;
		if (e.key === 'Backspace') {
			// Check if caret is right after a #uuid token
			const pos = ta.selectionStart;
			const textBefore = ta.value.substring(0, pos);
			const uuidMatch = textBefore.match(
				/#([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
			);
			if (uuidMatch) {
				e.preventDefault();
				const start = pos - uuidMatch[0].length;
				ta.value = ta.value.substring(0, start) + ta.value.substring(pos);
				draft.body = ta.value;
				ta.selectionStart = ta.selectionEnd = start;
				return;
			}
		}
		if (e.key === 'Escape' && pickerOpen) {
			pickerOpen = false;
			e.preventDefault();
		}
	}

	function handlePickerPick(id: string) {
		if (!textareaRef) return;
		const ta = textareaRef;
		const pos = ta.selectionStart;
		const value = ta.value;
		// Find the # that started this filter sequence
		const beforeCaret = value.substring(0, pos);
		const hashIdx = beforeCaret.lastIndexOf('#');
		if (hashIdx >= 0) {
			// Replace the # + any filter text with #<uuid>
			const insert = '#' + id;
			ta.value = value.substring(0, hashIdx) + insert + value.substring(pos);
			draft.body = ta.value;
			const newPos = hashIdx + insert.length;
			ta.selectionStart = ta.selectionEnd = newPos;
		}
		pickerOpen = false;
	}

	function handleChipChange(id: string) {
		// Position the caret right after the #uuid token so the picker, when
		// it inserts, replaces only that token and leaves the rest of the
		// direction body intact.
		if (textareaRef) {
			const idx = textareaRef.value.indexOf('#' + id);
			if (idx >= 0) {
				const caret = idx + ('#' + id).length;
				textareaRef.focus();
				textareaRef.selectionStart = textareaRef.selectionEnd = caret;
			}
		}
		pickerOpen = true;
	}

	function handleChipRemove(id: string) {
		// Replace #<id> (and one trailing whitespace) with empty string.
		// Escape any regex-special chars in id, then add an optional
		// whitespace after the literal token.
		const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`#${escaped}\\s?`, 'g');
		draft.body = draft.body.replace(regex, '').trim();
		// Mirror the change into the textarea DOM so bind:value re-syncs
		// (the chip overlay reads from draft.body but the textarea also
		// caches its value internally).
		if (textareaRef) {
			textareaRef.value = draft.body;
		}
	}

	// Focus the textarea when editing starts — avoids bind:this hydration issues
	$effect(() => {
		if (editing && editTab === 'details') {
			requestAnimationFrame(() => {
				(document.querySelector('[data-editing-direction]') as HTMLTextAreaElement)?.focus();
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
				<div class="relative">
					<textarea
						class="border rounded px-3 py-2 w-full"
						rows="3"
						placeholder="Direction"
						aria-label="Direction"
						data-editing-direction
						bind:value={draft.body}
						bind:this={textareaRef}
						oninput={handleTextareaInput}
						onkeydown={handleTextareaKeydown}
						onfocus={() => (textareaFocused = true)}
						onblur={() => (textareaFocused = false)}
						style="background:transparent; position:relative; z-index:1; color:{textareaFocused ? 'inherit' : 'transparent'}; caret-color:{textareaFocused ? 'black' : 'transparent'}; pointer-events:{textareaFocused ? 'auto' : 'none'};"
					></textarea>
					<!-- Chip overlay -->
					<div
						bind:this={overlayRef}
						class="absolute top-0 left-0 right-0 bottom-0 overflow-hidden pointer-events-none px-3 py-2 border rounded whitespace-pre-wrap break-word"
						style="font-family: inherit; font-size: inherit; line-height: inherit; pointer-events:none; display: {textareaFocused
							? 'none'
							: 'block'};"
						aria-hidden="true"
					>
						{#each compiled.compiled as seg}
							{#if seg.type === 'chip'}
								<span
									class="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 rounded px-1 py-0.5"
									style="pointer-events:auto;"
								>
									<span>{seg.displayText}</span>
									<button
										type="button"
										class="text-xs underline hover:text-amber-900"
										onclick={() => handleChipChange(seg.id)}>Change</button
									>
									<button
										type="button"
										class="text-xs underline hover:text-amber-900"
										onclick={() => handleChipRemove(seg.id)}>Remove</button
									>
								</span>
							{:else}
								<span>{seg.value}</span>
							{/if}
						{/each}
					</div>
				</div>
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