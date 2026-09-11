<script lang="ts">
	import type { Ingredient } from '$lib/obj/Recipe.svelte';
	import { formatAmount } from '$lib/formatAmount';
	import { parseAmount } from '$lib/parseAmount';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import Tabs from './Tabs.svelte';
	import NoteIcon from './NoteIcon.svelte';

	type Props = {
		ingredient: Ingredient;
		index: number;
		total: number;
		note: string | null;
		onNote: () => void;
		onUpdate: (next: Ingredient) => void;
		onUpdateNote: (note: string | null) => void;
		onRemove: () => void;
		onMove: (direction: 'up' | 'down') => void;
		readOnly?: boolean;
	};

	let {
		ingredient,
		index,
		total,
		note,
		onNote,
		onUpdate,
		onUpdateNote,
		onRemove,
		onMove,
		readOnly = false
	}: Props = $props();

	let editing = $state(false);
	let draft = $state<Ingredient>({ ...ingredient });
	let amountDraft = $state('');
	let amountError = $state<string | null>(null);
	let editTab = $state<'details' | 'note'>('details');
	let noteDraft = $state('');

	function startEdit() {
		draft = { ...ingredient };
		amountDraft = ingredient.amount ? String(ingredient.amount) : '';
		amountError = null;
		noteDraft = note ?? '';
		editTab = 'details';
		editing = true;
	}

	function cancelEdit() {
		editing = false;
	}

	function doEdit() {
		const amtResult = parseAmount(amountDraft);
		if (amtResult.error) {
			amountError = amtResult.error;
			return;
		}
		amountError = null;
		onUpdate({ ...draft, amount: amtResult.value! });
		const trimmedNote = noteDraft.trim();
		onUpdateNote(trimmedNote.length > 0 ? trimmedNote : null);
		editing = false;
	}

	function confirmRemove() {
		if (window.confirm(`Remove ingredient "${ingredient.name}"?`)) {
			onRemove();
		}
	}

	// Focus the name input when editing starts — avoids bind:this hydration issues
	$effect(() => {
		if (editing && editTab === 'details') {
			requestAnimationFrame(() => {
				(document.querySelector('[data-editing-ingredient]') as HTMLInputElement)?.focus();
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

<li
	class="flex items-start gap-2"
	class:items-center={!note || !readOnly}
	data-testid="ingredient-row"
	data-ingredient-name={ingredient.name}
>
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
				<input
					class="border rounded px-3 py-2"
					placeholder="Ingredient name"
					aria-label="Ingredient name"
					data-editing-ingredient
					bind:value={draft.name}
				/>
				<div class="flex gap-2">
					<input
						class="border rounded px-3 py-2 w-24"
						placeholder="Amount (e.g. 1/3, 1 1/2)"
						type="text"
						inputmode="numeric"
						bind:value={amountDraft}
					/>
					<input
						class="border rounded px-3 py-2 flex-1"
						placeholder="Unit"
						bind:value={draft.unit}
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
					bind:value={noteDraft}
				></textarea>
			{/if}
			<div class="flex gap-2">
				<button type="button" class="btn-amber" onclick={doEdit}>Save</button>
				<button type="button" class="btn-amber secondary" onclick={cancelEdit}>Cancel</button>
			</div>
		</form>
	{:else}
		<!-- read-only + editable ingredient row, optionally with note below -->
		<div class="flex flex-col gap-1 flex-1 min-w-0">
			<div class="flex items-center gap-2">
				<span class="flex-1 flex items-center min-w-0">
					<span class="opacity-60 mr-2">{index + 1}.</span>
					<span>{ingredient.name}</span>
					<span class="opacity-60 ml-1">{formatAmount(ingredient.amount)}</span>
					<span class="opacity-60 ml-1">{ingredient.unit}</span>
				</span>
				{#if note && !readOnly}
					<button
						type="button"
						class="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 shrink-0"
						title={note}
						aria-label="Edit note"
						onclick={onNote}
						data-testid="ingredient-note-button"
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
			<ContextMenu {items} label={`Actions for ${ingredient.name}`} />
		{/if}
	{/if}
</li>
