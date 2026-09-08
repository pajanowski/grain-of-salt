<script lang="ts">
	import Recipe from '$lib/component/Recipe.svelte';
	import RecipeHistory from '$lib/component/RecipeHistory.svelte';

	const { data } = $props();
	let parentChain = $derived(data.parentChain);
</script>

<div class="mx-auto max-w-3xl px-4 py-6">
	{#if parentChain.length > 0}
		<nav class="mb-4 text-sm text-stone-500">
			{#each parentChain as p, i (p.id)}
			<a href="/mise/recipes/{p.id}" class="hover:underline">{p.name}</a>{i < parentChain.length - 1 ? ' → ' : ''}
			{/each}
			<span>→ </span>
		</nav>
	{/if}

	<Recipe {data} />
	<RecipeHistory history={data.history} />
</div>
