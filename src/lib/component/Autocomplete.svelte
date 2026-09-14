<script lang="ts">
	import { browser } from '$app/environment';
	import AutocompleteDropdown from './AutocompleteDropdown.svelte';

	export type AutocompleteItem = {
		value: string;
		label: string;
	};

	let {
		items,
		value = $bindable(''),
		placeholder = '',
		onchange,
		onExactMatch
	}: {
		items: AutocompleteItem[];
		value?: string;
		placeholder?: string;
		onchange?: (v: string) => void;
		onExactMatch?: (search: string, items: AutocompleteItem[]) => void;
	} = $props();

	let open = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);
	let search = $state(value);
	let highlightedIndex = $state(-1);

	$effect(() => {
		search = value;
	});

	const trimmedSearch = $derived(search.trim());

	const filteredItems = $derived(
		trimmedSearch.length === 0
			? items
			: items.filter(
					(item) =>
						item.label.toLowerCase().includes(trimmedSearch.toLowerCase()) ||
						item.value.toLowerCase().includes(trimmedSearch.toLowerCase())
				)
	);

	const exactMatch = $derived(
		trimmedSearch.length > 0 &&
			items.some(
				(item) =>
					item.value.toLowerCase() === trimmedSearch.toLowerCase() ||
					item.label.toLowerCase() === trimmedSearch.toLowerCase()
			)
	);

	let lastExactMatchSearch = $state('');
	$effect(() => {
		if (!exactMatch) {
			lastExactMatchSearch = '';
			return;
		}
		const normalized = trimmedSearch.toLowerCase();
		if (normalized === lastExactMatchSearch) return;
		lastExactMatchSearch = normalized;
		onExactMatch?.(trimmedSearch, items);
	});

	function selectItem(itemValue: string) {
		value = itemValue;
		onchange?.(itemValue);
		search = itemValue;
		open = false;
		highlightedIndex = -1;
	}

	function close() {
		open = false;
		highlightedIndex = -1;
	}

	// Close the dropdown on outside click.
	$effect(() => {
		if (!open || !browser) return;

		function onDocClick(e: MouseEvent) {
			if (inputEl && inputEl.contains(e.target as Node)) return;
			close();
		}

		document.addEventListener('click', onDocClick, true);
		return () => {
			document.removeEventListener('click', onDocClick, true);
		};
	});

	function onInput(e: Event) {
		search = (e.target as HTMLInputElement).value;
		highlightedIndex = -1;
		open = true;
	}

	function onFocus() {
		open = true;
	}

	function onBlur() {
		if (trimmedSearch.length > 0) {
			onExactMatch?.(trimmedSearch, items);
		}
	}
</script>

<input
	bind:this={inputEl}
	{placeholder}
	type="text"
	aria-label="Unit"
	bind:value={search}
	oninput={onInput}
	onfocus={onFocus}
	onblur={onBlur}
/>

<AutocompleteDropdown
	items={filteredItems.map((item) => ({ value: item.value, label: item.label }))}
	{open}
	anchor={inputEl}
	onSelect={(item) => selectItem(item.value as string)}
	onClose={close}
	bind:highlightedIndex
	emptyLabel={trimmedSearch ? `No matches for "${trimmedSearch}"` : 'No results.'}
/>