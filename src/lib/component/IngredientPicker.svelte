<script lang="ts">
	import { browser } from '$app/environment';
	import type { Ingredient } from '$lib/obj/Recipe.svelte.js';
	import { formatAmount } from '$lib/formatAmount.js';

	let {
		ingredients,
		onPick,
		onClose,
		open,
		filterText,
		textareaRef
	}: {
		ingredients: Ingredient[];
		onPick: (id: string) => void;
		onClose: () => void;
		open: boolean;
		filterText: string;
		textareaRef: HTMLTextAreaElement;
	} = $props();

	let highlightedIndex = $state(-1);
	let menuEl = $state<HTMLDivElement | null>(null);

	const trimmedFilter = $derived(filterText.trim().toLowerCase());

	const filteredIngredients = $derived(
		trimmedFilter.length === 0
			? ingredients
			: ingredients.filter((i) => i.name.toLowerCase().includes(trimmedFilter))
	);

	function itemLabel(ing: Ingredient): string {
		if (!ing.amount && !ing.unit) return ing.name;
		if (!ing.amount) return `${ing.name} (${ing.unit})`;
		if (!ing.unit) return `${ing.name} (${formatAmount(ing.amount)})`;
		return `${ing.name} (${formatAmount(ing.amount)} ${ing.unit})`;
	}

	function selectItem(ing: Ingredient) {
		onPick(ing.id);
		highlightedIndex = -1;
	}

	function close() {
		highlightedIndex = -1;
		onClose();
	}

	$effect(() => {
		if (open) {
			highlightedIndex = -1;
		}
	});

	$effect(() => {
		// Keep highlightedIndex in bounds when filter changes
		if (highlightedIndex >= filteredIngredients.length) {
			highlightedIndex = Math.max(filteredIngredients.length - 1, -1);
		}
	});

	$effect(() => {
		if (!open || !browser) return;

		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.stopPropagation();
				close();
				return;
			}
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				e.stopPropagation();
				highlightedIndex =
					highlightedIndex < filteredIngredients.length - 1 ? highlightedIndex + 1 : 0; // wrap
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				e.stopPropagation();
				highlightedIndex =
					highlightedIndex > 0 ? highlightedIndex - 1 : filteredIngredients.length - 1; // wrap
				return;
			}
			if (e.key === 'Enter') {
				if (highlightedIndex >= 0 && highlightedIndex < filteredIngredients.length) {
					e.preventDefault();
					e.stopPropagation();
					selectItem(filteredIngredients[highlightedIndex]);
				}
				return;
			}
			if (e.key === 'Tab') {
				if (highlightedIndex >= 0 && highlightedIndex < filteredIngredients.length) {
					e.preventDefault();
					e.stopPropagation();
					selectItem(filteredIngredients[highlightedIndex]);
				}
				return;
			}
		}

		document.addEventListener('keydown', onKeydown, true);
		return () => {
			document.removeEventListener('keydown', onKeydown, true);
		};
	});

	// Position computed from textareaRef caret location.
	// Use a separate $state + $effect so we recompute whenever open changes
	// (not just when textareaRef itself changes — which can be null on first render).
	let menuStyle = $state('display:none;');

	$effect(() => {
		if (open && textareaRef) {
			const rect = textareaRef.getBoundingClientRect();
			menuStyle = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;`;
		} else {
			menuStyle = 'display:none;';
		}
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		role="listbox"
		data-testid="ingredient-picker-listbox"
		class="min-w-48 bg-white border rounded shadow-lg z-50 py-1 max-h-64 overflow-y-auto"
		style={menuStyle}
		bind:this={menuEl}
	>
		{#if filteredIngredients.length === 0}
			<span class="block px-3 py-1.5 text-sm text-gray-500">
				{trimmedFilter ? `No matches for "${filterText}"` : 'No ingredients.'}
			</span>
		{:else}
			{#each filteredIngredients as ing, i (ing.id)}
				<button
					type="button"
					role="option"
					aria-selected={highlightedIndex === i}
					class="w-full text-left px-3 py-1.5 text-sm outline-none flex items-center gap-2"
					class:bg-amber-50={highlightedIndex === i}
					onclick={() => selectItem(ing)}
					onmouseenter={() => (highlightedIndex = i)}
				>
					{itemLabel(ing)}
				</button>
			{/each}
		{/if}
	</div>
{/if}
