<script lang="ts">
	import type { Ingredient } from '$lib/obj/Recipe.svelte.js';
	import { formatAmount } from '$lib/formatAmount.js';
	import AutocompleteDropdown from './AutocompleteDropdown.svelte';

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

	function pick(ing: Ingredient) {
		onPick(ing.id);
		highlightedIndex = -1;
	}

	function close() {
		highlightedIndex = -1;
		onClose();
	}
</script>

<AutocompleteDropdown
	items={filteredIngredients.map((ing) => ({
		value: ing.id,
		label: itemLabel(ing),
		id: ing.id
	}))}
	{open}
	anchor={textareaRef}
	onSelect={(item) => {
		const ing = ingredients.find((i) => i.id === item.value);
		if (ing) pick(ing);
	}}
	onClose={close}
	bind:highlightedIndex
	emptyLabel={trimmedFilter ? `No matches for "${filterText}"` : 'No ingredients.'}
	class="min-w-48"
	testid="ingredient-picker-listbox"
/>