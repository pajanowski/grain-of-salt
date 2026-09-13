<script lang="ts">
	import type { Ingredient } from '$lib/obj/Recipe.svelte.js';
	import { compileDirection } from '$lib/obj/directionCompile.js';

	let {
		body,
		ingredients,
		onChipClick
	}: {
		body: string;
		ingredients: Ingredient[];
		onChipClick?: (id: string) => void;
	} = $props();

	const compiled = $derived(compileDirection(body, ingredients));
</script>

<span class="direction-body">
	{#each compiled.compiled as segment}
		{#if segment.type === 'text'}
			<span>{segment.value}</span>
		{:else}
			{#if onChipClick}
				<button
					type="button"
					class="chip"
					onclick={() => onChipClick(segment.id)}
					aria-label={segment.displayText}
				>
					{segment.displayText}
				</button>
			{:else}
				<span class="chip" aria-label={segment.displayText}>{segment.displayText}</span>
			{/if}
		{/if}
	{/each}
</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		background: #fef3c7;
		color: #92400e;
		font-size: 0.875em;
	}
</style>
