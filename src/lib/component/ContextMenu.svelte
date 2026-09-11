<script lang="ts">
	/**
	 * Generic three-dot context menu. Renders a button that, when clicked,
	 * opens a dropdown anchored to the button. Closes on outside-click or
	 * Escape.
	 *
	 * Each menu item is either a `{ label, onSelect }` action or a
	 * `{ label, disabled: true, title? }` disabled row. The parent is
	 * responsible for the action callbacks (e.g. opening an edit form).
	 *
	 * Positioning: the menu is rendered inside the component but uses
	 * `position: fixed` with coordinates computed from the trigger's
	 * `getBoundingClientRect()`. This avoids overflow clipping from
	 * ancestor containers (e.g. `overflow: hidden` on the rounded card).
	 */

	import { browser } from '$app/environment';

	export type MenuItem =
		| { label: string; onSelect: () => void | Promise<void>; disabled?: boolean; title?: string; danger?: boolean }
		| { label: string; disabled: true; title?: string };

	let { items, label = 'Actions' }: { items: MenuItem[]; label?: string } = $props();

	let open = $state(false);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let menuEl = $state<HTMLDivElement | null>(null);

	function selectItem(item: MenuItem) {
		if ('disabled' in item && item.disabled) return;
		if ('onSelect' in item) item.onSelect();
		close();
	}

	function openMenu() {
		open = true;
	}

	function close() {
		open = false;
	}

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		open ? close() : openMenu();
	}

	$effect(() => {
		if (!open || !browser) return;

		function onDocClick(e: MouseEvent) {
			if (triggerEl && triggerEl.contains(e.target as Node)) return;
			if (menuEl && menuEl.contains(e.target as Node)) return;
			close();
		}

		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') close();
		}

		document.addEventListener('click', onDocClick, true);
		document.addEventListener('keydown', onKeydown);
		return () => {
			document.removeEventListener('click', onDocClick, true);
			document.removeEventListener('keydown', onKeydown);
		};
	});

	// Re-compute position whenever the menu opens
	let menuStyle = $derived(
		open && triggerEl
			? (() => {
					const r = triggerEl.getBoundingClientRect();
					return `position:fixed;top:${r.bottom + 4}px;right:${window.innerWidth - r.right}px;`;
				})()
			: 'display:none;'
	);
</script>

<button
	type="button"
	class="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-gray-100"
	aria-label={label}
	aria-haspopup="menu"
	aria-expanded={open}
	bind:this={triggerEl}
	onclick={toggle}
>
	⋮
</button>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		role="menu"
		class="min-w-40 bg-white border rounded shadow-lg z-50 py-1"
		style={menuStyle}
		bind:this={menuEl}
	>
		{#each items as item, i (i)}
			{#if 'disabled' in item && item.disabled}
				<span
					class="block px-3 py-1.5 text-sm opacity-40 cursor-not-allowed"
					title={'title' in item ? item.title : ''}
					role="menuitem"
					aria-disabled="true"
				>
					{item.label}
				</span>
			{:else}
				<button
					type="button"
					role="menuitem"
					class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 data-[highlighted]:bg-gray-100 outline-none"
					class:text-red-700={'danger' in item && item.danger}
					title={'title' in item ? item.title : ''}
					onclick={() => selectItem(item)}
				>
					{item.label}
				</button>
			{/if}
		{/each}
	</div>
{/if}
