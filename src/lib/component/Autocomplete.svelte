<script lang="ts">
	import { browser } from '$app/environment';
	import { tick } from 'svelte';

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
	let menuEl = $state<HTMLDivElement | null>(null);
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

	function close() {
		open = false;
		highlightedIndex = -1;
	}

	function selectItem(itemValue: string) {
		value = itemValue;
		onchange?.(itemValue);
		search = itemValue;
		close();
		tick().then(() => inputEl?.focus());
	}

	$effect(() => {
		if (!open || !browser) return;

		function onDocClick(e: MouseEvent) {
			if (inputEl && inputEl.contains(e.target as Node)) return;
			if (menuEl && menuEl.contains(e.target as Node)) return;
			close();
		}

		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.stopPropagation();
				close();
			}
		}

		document.addEventListener('click', onDocClick, true);
		document.addEventListener('keydown', onKeydown, true);
		return () => {
			document.removeEventListener('click', onDocClick, true);
			document.removeEventListener('keydown', onKeydown, true);
		};
	});

	let menuStyle = $derived(
		open && inputEl
			? (() => {
					const r = inputEl.getBoundingClientRect();
					return `position:fixed;top:${r.bottom + 4}px;left:${r.left}px;`;
				})()
			: 'display:none;'
	);

	function onInput(e: Event) {
		search = (e.target as HTMLInputElement).value;
		highlightedIndex = -1;
		open = true;
	}

	function onInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			close();
			return;
		}
		if (e.key === 'Tab') {
			if (open) {
				e.preventDefault();
				highlightedIndex = Math.min(highlightedIndex + 1, filteredItems.length - 1);
			}
			return;
		}
		if (e.key === 'Tab' && e.shiftKey) {
			if (open) {
				e.preventDefault();
				highlightedIndex = Math.max(highlightedIndex - 1, 0);
			}
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightedIndex = Math.min(highlightedIndex + 1, filteredItems.length - 1);
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
			return;
		}
		if (e.key === 'Enter') {
			if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
				selectItem(filteredItems[highlightedIndex].value);
			}
			return;
		}
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
	onkeydown={onInputKeydown}
	onfocus={onFocus}
	onblur={onBlur}
/>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		role="listbox"
		class="min-w-40 bg-white border rounded shadow-lg z-50 py-1"
		style={menuStyle}
		bind:this={menuEl}
	>
		{#if filteredItems.length === 0}
			<span class="block px-3 py-1.5 text-sm text-gray-500">
				{trimmedSearch ? `No matches for "${trimmedSearch}"` : 'No results.'}
			</span>
		{:else}
			{#each filteredItems as item, i (item.value)}
				<button
					type="button"
					role="option"
					aria-selected={highlightedIndex === i}
					class="w-full text-left px-3 py-1.5 text-sm outline-none flex items-center gap-2"
					class:bg-gray-100={highlightedIndex === i}
					onclick={() => selectItem(item.value)}
					onmouseenter={() => (highlightedIndex = i)}
				>
					{item.label}
				</button>
			{/each}
		{/if}
	</div>
{/if}
