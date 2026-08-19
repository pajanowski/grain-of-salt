<script lang="ts">
	/**
	 * Generic three-dot context menu. Renders a button that, when clicked,
	 * opens a popover anchored to the button. The popover closes on
	 * outside-click or Escape.
	 *
	 * Each menu item is either a `{ label, onSelect }` action or a
	 * `{ label, disabled: true, title? }` disabled row. The parent is
	 * responsible for the action callbacks (e.g. opening an edit form).
	 */

	export type MenuItem =
		| { label: string; onSelect: () => void | Promise<void>; disabled?: boolean; title?: string; danger?: boolean }
		| { label: string; disabled: true; title?: string };

	let { items, label = 'Actions' }: { items: MenuItem[]; label?: string } = $props();

	let open = $state(false);
	let triggerEl: HTMLButtonElement | undefined = $state();
	let menuEl: HTMLDivElement | undefined = $state();

	function close() {
		open = false;
	}

	function handleTriggerClick() {
		open = !open;
	}

	function handleDocClick(e: MouseEvent) {
		if (!open) return;
		const target = e.target as Node;
		if (triggerEl?.contains(target)) return;
		if (menuEl?.contains(target)) return;
		close();
	}

	function handleKey(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') close();
	}

	function selectItem(item: MenuItem) {
		if ('disabled' in item && item.disabled) return;
		if ('onSelect' in item) item.onSelect();
		close();
	}
</script>

<svelte:document onclick={handleDocClick} onkeydown={handleKey} />

<div class="relative inline-block">
	<button
		bind:this={triggerEl}
		type="button"
		class="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-gray-100"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={label}
		onclick={handleTriggerClick}
	>
		⋮
	</button>

	{#if open}
		<div
			bind:this={menuEl}
			role="menu"
			class="absolute right-0 mt-1 min-w-40 bg-white border rounded shadow-lg z-20 py-1"
		>
			{#each items as item, i (i)}
				{@const isDisabled = 'disabled' in item && item.disabled}
				<button
					type="button"
					role="menuitem"
					disabled={isDisabled}
					class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
					class:text-red-700={'danger' in item && item.danger}
					title={'title' in item ? item.title : ''}
					onclick={() => selectItem(item)}
				>
					{item.label}
				</button>
			{/each}
		</div>
	{/if}
</div>
