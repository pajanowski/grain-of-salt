<script lang="ts">
	import type { Ingredient } from '$lib/obj/Recipe.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';

	type Props = {
		ingredient: Ingredient;
		index: number;
		total: number;
		onUpdate: (next: Ingredient) => void;
		onRemove: () => void;
		onMove: (direction: 'up' | 'down') => void;
	};

	let { ingredient, index, total, onUpdate, onRemove, onMove }: Props = $props();

	let editing = $state(false);
	let draft = $state<Ingredient>({ ...ingredient });

	function startEdit() {
		draft = { ...ingredient };
		editing = true;
	}

	function cancelEdit() {
		editing = false;
	}

	function saveEdit() {
		onUpdate({ ...draft });
		editing = false;
	}

	function confirmRemove() {
		if (window.confirm(`Remove ingredient "${ingredient.name}"?`)) {
			onRemove();
		}
	}

	const items: MenuItem[] = $derived([
		{ label: 'Edit', onSelect: startEdit },
		{
			label: 'Move up',
			disabled: index === 0,
			onSelect: () => onMove('up'),
		},
		{
			label: 'Move down',
			disabled: index === total - 1,
			onSelect: () => onMove('down'),
		},
		{ label: 'Remove', onSelect: confirmRemove, danger: true },
	]);
</script>

<li class="flex items-center gap-2" data-testid="ingredient-row" data-ingredient-name={ingredient.name}>
	{#if editing}
		<form
			class="flex flex-wrap items-center gap-2 flex-1"
			onsubmit={(e) => {
				e.preventDefault();
				saveEdit();
			}}
		>
			<input
				class="border rounded px-2 py-1 flex-1 min-w-32"
				placeholder="Name"
				bind:value={draft.name}
			/>
			<input
				class="border rounded px-2 py-1 w-20"
				placeholder="Amount"
				type="number"
				step="any"
				bind:value={draft.amount}
			/>
			<input
				class="border rounded px-2 py-1 w-20"
				placeholder="Unit"
				bind:value={draft.unit}
			/>
			<button
				type="submit"
				class="px-2 py-1 text-sm rounded border hover:bg-gray-100">Save</button
			>
			<button
				type="button"
				class="px-2 py-1 text-sm rounded border hover:bg-gray-100"
				onclick={cancelEdit}>Cancel</button
			>
		</form>
	{:else}
		<span class="flex-1">
			<span class="opacity-60 mr-2">{index + 1}.</span>
			<span>{ingredient.name}</span>
			<span class="opacity-60 ml-1">{ingredient.amount}</span>
			<span class="opacity-60 ml-1">{ingredient.unit}</span>
		</span>
		<ContextMenu {items} label={`Actions for ${ingredient.name}`} />
	{/if}
</li>
