<script lang="ts">
	import type { Ingredient } from '$lib/obj/Recipe.svelte';
	import { formatAmount } from '$lib/formatAmount';
	import { parseAmount } from '$lib/parseAmount';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';

	type Props = {
		ingredient: Ingredient;
		index: number;
		total: number;
		note: string | null;
		onNote: () => void;
		onUpdate: (next: Ingredient) => void;
		onRemove: () => void;
		onMove: (direction: 'up' | 'down') => void;
		readOnly?: boolean;
	};

	let { ingredient, index, total, note, onNote, onUpdate, onRemove, onMove, readOnly = false }: Props = $props();

	let editing = $state(false);
	let draft = $state<Ingredient>({ ...ingredient });
	let amountDraft = $state('');
	let amountError = $state<string | null>(null);

	function startEdit() {
		draft = { ...ingredient };
		amountDraft = ingredient.amount ? String(ingredient.amount) : '';
		amountError = null;
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
		editing = false;
	}

	function confirmRemove() {
		if (window.confirm(`Remove ingredient "${ingredient.name}"?`)) {
			onRemove();
		}
	}

	// Focus the name input when editing starts — avoids bind:this hydration issues
	$effect(() => {
		if (editing) {
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
	class="flex items-center gap-2"
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
			<div class="flex gap-2">
				<button type="button" class="btn-amber" onclick={doEdit}>Save</button>
				<button type="button" class="btn-amber secondary" onclick={cancelEdit}>Cancel</button>
			</div>
		</form>
	{:else}
		<span class="flex-1">
			<span class="opacity-60 mr-2">{index + 1}.</span>
			<span>{ingredient.name}</span>
			<span class="opacity-60 ml-1">{formatAmount(ingredient.amount)}</span>
			<span class="opacity-60 ml-1">{ingredient.unit}</span>
		</span>
		{#if note}
			<span
				class="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-amber-100 text-amber-800"
				title={note}
				data-testid="ingredient-note-button"
			>
				📝
			</span>
		{/if}
		{#if !readOnly}
			<ContextMenu {items} label={`Actions for ${ingredient.name}`} />
		{/if}
	{/if}
</li>
