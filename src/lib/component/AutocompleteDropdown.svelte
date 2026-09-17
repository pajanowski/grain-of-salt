<!--
Reusable autocomplete dropdown (the listbox portion of an autocomplete
control). The parent owns the input / filter / value-state; this
component only renders the floating listbox, owns keyboard navigation
(Tab/Shift+Tab/ArrowDown/ArrowUp/Enter/Escape) and the highlighted index,
and emits a select callback when the user picks an item.

The dropdown anchors to `anchor` (a DOM element, e.g. an input or a
textarea) by computing a fixed-position style from its bounding rect.
While `open` is true, keydown events are captured at the document level
so navigation still works while focus is in an arbitrary input
(textareas, custom inputs, etc).

The listbox itself is also keyboard-friendly: Tab and Shift+Tab move
the highlight only (navigation, no selection); Enter activates the
highlighted option; Escape closes. This is the behaviour the
ingredient-ref picker wanted, and it also makes the standalone
Autocomplete unit more accessible.
-->
<script lang="ts">
	import { browser } from '$app/environment';

	type DropdownItem<V> = {
		value: V;
		label: string;
		/** Optional id used as the Svelte each-block key. Falls back to `value`. */
		id?: string;
	};

	let {
		items,
		open,
		anchor,
		onSelect,
		onClose,
		highlightedIndex = $bindable(-1),
		emptyLabel = 'No results.',
		class: className = '',
		testid
	}: {
		items: DropdownItem<unknown>[];
		open: boolean;
		/** Element to anchor the floating listbox to (input or textarea). */
		anchor: HTMLElement | null;
		onSelect: (item: DropdownItem<unknown>) => void;
		onClose: () => void;
		/** Two-way binding so the parent can read/highlight programmatically. */
		highlightedIndex?: number;
		emptyLabel?: string;
		class?: string;
		/** Optional data-testid for e2e selectors. */
		testid?: string;
	} = $props();

	function clamp(index: number) {
		if (items.length === 0) return -1;
		if (index < 0) return items.length - 1;
		if (index >= items.length) return 0;
		return index;
	}

	function selectIndex(i: number) {
		const item = items[i];
		if (!item) return;
		onSelect(item);
	}

	function onListboxKeydown(e: KeyboardEvent) {
		// Tab inside the listbox moves between options like a native
		// listbox: Tab -> next, Shift+Tab -> previous (navigation only;
		// Enter is the only activation key in this branch).
		if (e.key === 'Tab') {
			e.preventDefault();
			const next = e.shiftKey
				? clamp(highlightedIndex - 1)
				: clamp(highlightedIndex + 1);
			highlightedIndex = next;
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightedIndex = clamp(highlightedIndex + 1);
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightedIndex = clamp(highlightedIndex - 1);
			return;
		}
		if (e.key === 'Enter') {
			if (highlightedIndex >= 0 && highlightedIndex < items.length) {
				e.preventDefault();
				selectIndex(highlightedIndex);
			}
			return;
		}
	}

	// Global keydown capture so navigation works even when the trigger
	// is a textarea (which has its own keydown handlers we'd otherwise
	// fight). While the dropdown is open, we intercept Tab/Arrow/Enter
	// before they bubble to the trigger.
	$effect(() => {
		if (!open || !browser) return;

		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.stopPropagation();
				onClose();
				return;
			}
			if (e.key === 'Tab') {
				e.preventDefault();
				e.stopPropagation();
				const next = e.shiftKey
					? clamp(highlightedIndex - 1)
					: clamp(highlightedIndex + 1);
				highlightedIndex = next;
				return;
			}
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				e.stopPropagation();
				highlightedIndex = clamp(highlightedIndex + 1);
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				e.stopPropagation();
				highlightedIndex = clamp(highlightedIndex - 1);
				return;
			}
			if (e.key === 'Enter') {
				if (highlightedIndex >= 0 && highlightedIndex < items.length) {
					e.preventDefault();
					e.stopPropagation();
					selectIndex(highlightedIndex);
				}
				return;
			}
		}

		document.addEventListener('keydown', onKeydown, true);
		return () => {
			document.removeEventListener('keydown', onKeydown, true);
		};
	});

	// Reset highlight when the dropdown opens or the item set changes
	// shape.
	$effect(() => {
		if (!open) {
			highlightedIndex = -1;
		} else if (highlightedIndex < 0 && items.length > 0) {
			// Open focused on the first option, like a native listbox.
			highlightedIndex = 0;
		} else if (highlightedIndex >= items.length) {
			highlightedIndex = items.length > 0 ? 0 : -1;
		}
	});

	let menuStyle = $derived.by(() => {
		if (!open || !anchor) return 'display:none;';
		const r = anchor.getBoundingClientRect();
		return `position:fixed;top:${r.bottom + 4}px;left:${r.left}px;`;
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		role="listbox"
		tabindex="-1"
		class="min-w-40 bg-white border rounded shadow-lg z-50 py-1 max-h-64 overflow-y-auto outline-none {className}"
		style={menuStyle}
		data-testid={testid}
		onkeydown={onListboxKeydown}
	>
		{#if items.length === 0}
			<span class="block px-3 py-1.5 text-sm text-gray-500">{emptyLabel}</span>
		{:else}
			{#each items as item, i (item.id ?? item.value)}
				<button
					type="button"
					role="option"
					aria-selected={highlightedIndex === i}
					data-autocomplete-option
					data-index={i}
					class="w-full text-left px-3 py-1.5 text-sm outline-none flex items-center gap-2"
					class:bg-gray-100={highlightedIndex === i}
					onclick={() => selectIndex(i)}
					onmouseenter={() => (highlightedIndex = i)}
				>
					{item.label}
				</button>
			{/each}
		{/if}
	</div>
{/if}