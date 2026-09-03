<script lang="ts">
	import Recipe from '$lib/component/Recipe.svelte';
	import RecipeHistory from '$lib/component/RecipeHistory.svelte';

	const { data } = $props();
	let recipe = $derived(data.recipe);
	let history = $derived(data.history);
	let parentChain = $derived(data.parentChain);
</script>

<div class="max-w-200">
	{#if parentChain.length > 0}
		<nav class="text-sm opacity-70 mb-2">
			{#each parentChain as p, i (p.id)}
				<a href="/recipes/{p.id}">{p.name}</a>{i < parentChain.length - 1 ? ' → ' : ''}
			{/each}
			<span class="opacity-50">→ </span>
		</nav>
	{/if}

	<Recipe {data} />
	<RecipeHistory {history} />
</div>
