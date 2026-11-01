<script lang="ts">
	import Recipe from '$lib/component/Recipe.svelte';
	import RecipeHistory from '$lib/component/RecipeHistory.svelte';
	import { isDemoMode } from '$lib/demo-init';
	import { demoStore, demoNodes } from '$lib/recipe-store.demo';
	import { page } from '$app/state';

	const { data } = $props();

	let demoData = $state<any>(null);

	$effect(() => {
		if (data.demoMode || isDemoMode) {
			const slug = page.params.slug;
			if (slug) {
				const unsub = demoNodes.subscribe(async () => {
					const view = await demoStore.getRecipeView(slug);
					if (view) {
						demoData = {
							...data,
							...view
						};
					}
				});
				return () => unsub();
			}
		}
	});

	let activeData = $derived(demoData ?? data);
	let parentChain = $derived(activeData.parentChain ?? []);
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

	<Recipe data={activeData} />
	<RecipeHistory history={activeData.history ?? []} />
</div>
