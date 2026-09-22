<script lang="ts">
	import { ButtonGroup } from '$lib/components/ui/button-group/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import Search from '@lucide/svelte/icons/search';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';

	let {
		sidebarCollapsed,
		onSearch,
		onToggleSidebar
	}: {
		sidebarCollapsed: boolean;
		onSearch: () => void;
		onToggleSidebar: () => void;
	} = $props();
</script>

<div class="mfb-wrap md:hidden">
	<ButtonGroup orientation="horizontal" aria-label="Mobile actions">
		<Button variant="outline" size="icon" aria-label="Search recipes" onclick={onSearch}>
			<Search class="h-5 w-5" aria-hidden="true" />
		</Button>
		<Button
			variant="outline"
			size="icon"
			aria-label={sidebarCollapsed ? 'Open menu' : 'Close menu'}
			aria-expanded={!sidebarCollapsed}
			onclick={onToggleSidebar}
		>
			{#if sidebarCollapsed}
				<!-- Menu closed — show hamburger to open it -->
				<Menu class="h-5 w-5" aria-hidden="true" />
			{:else}
				<!-- Menu open — show X to close it -->
				<X class="h-5 w-5" aria-hidden="true" />
			{/if}
		</Button>
	</ButtonGroup>
</div>

<!--
	Floating positioning only — color/sizing comes from the shadcn Button
	component (`variant="outline" size="icon"`). The shadow on the wrapper
	keeps the FAB visually lifted above the content.
-->
<style>
	.mfb-wrap {
		position: fixed;
		left: 50%;
		bottom: 1rem;
		z-index: 50;
		transform: translateX(-50%);
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.1),
			0 4px 6px -4px rgba(0, 0, 0, 0.1);
		border-radius: 9999px;
	}
</style>
