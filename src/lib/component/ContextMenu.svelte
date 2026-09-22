<script lang="ts">
	/**
	 * Generic three-dot context menu. Renders a button that, when clicked,
	 * opens a dropdown anchored to the button. Closes on outside-click or
	 * Escape (handled by Bits UI's DismissibleLayer + EscapeLayer).
	 *
	 * Each menu item is either a `{ label, onSelect }` action or a
	 * `{ label, disabled: true, title? }` disabled row. The parent is
	 * responsible for the action callbacks (e.g. opening an edit form).
	 *
	 * Bits UI handles positioning and viewport-flip automatically, so
	 * the previous hand-rolled `getBoundingClientRect` math + manual
	 * outside-click capture are gone.
	 */

	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';

	export type MenuItem =
		| {
				label: string;
				onSelect: () => void | Promise<void>;
				disabled?: boolean;
				title?: string;
				danger?: boolean;
		  }
		| { label: string; disabled: true; title?: string };

	let { items, label = 'Actions' }: { items: MenuItem[]; label?: string } = $props();

	function handleSelect(item: MenuItem) {
		if ('onSelect' in item) item.onSelect();
	}

	function isDisabled(item: MenuItem): boolean {
		return 'disabled' in item && !!item.disabled;
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={label}
				aria-haspopup="menu"
				{...props}
			>
				<EllipsisVertical aria-hidden="true" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content>
		{#each items as item, i (i)}
			<DropdownMenu.Item
				disabled={isDisabled(item)}
				variant={'danger' in item && item.danger ? 'destructive' : 'default'}
				title={'title' in item ? item.title : undefined}
				onSelect={() => handleSelect(item)}
			>
				{item.label}
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
