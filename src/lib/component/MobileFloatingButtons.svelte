<script lang="ts">
	import { ButtonGroup } from '$lib/components/ui/button-group/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

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
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-5 w-5"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="7" />
				<path d="m21 21-4.3-4.3" />
			</svg>
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
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-5 w-5"
					aria-hidden="true"
				>
					<line x1="4" x2="20" y1="12" y2="12" />
					<line x1="4" x2="20" y1="6" y2="6" />
					<line x1="4" x2="20" y1="18" y2="18" />
				</svg>
			{:else}
				<!-- Menu open — show X to close it -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-5 w-5"
					aria-hidden="true"
				>
					<line x1="18" x2="6" y1="6" y2="18" />
					<line x1="6" x2="18" y1="6" y2="18" />
				</svg>
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
