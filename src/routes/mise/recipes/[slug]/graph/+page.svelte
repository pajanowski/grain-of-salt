<script lang="ts">
	import { browser } from '$app/environment';
	import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';
	import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';

	const { data } = $props();

	let subtree = $derived(data.subtree as RecipeTreeNode | null);
	let subtreeNodes = $derived(data.subtreeNodes as RecipeNode[]);
	let currentId = $derived(data.currentId as string);
</script>

<div class="mx-auto max-w-4xl px-4 py-6">
	<div class="mb-4">
		<h1 class="text-2xl font-bold text-stone-800">Recipe Graph</h1>
		<p class="mt-1 text-sm text-stone-500">
			Interactive view of the recipe node tree. Tap a node to visit its recipe.
		</p>
	</div>

	{#if subtree && subtreeNodes.length > 0}
		{#if browser}
			{#await import('/src/lib/component/RecipeGraph.svelte') then mod}
				<mod.default {subtree} {subtreeNodes} {currentId} />
			{:catch}
				<div class="flex h-[600px] items-center justify-center rounded border border-stone-300">
					<span class="text-stone-400">Failed to load graph.</span>
				</div>
			{/await}
		{:else}
			<div class="flex h-[600px] items-center justify-center rounded border border-stone-300">
				<span class="text-stone-400">Loading graph…</span>
			</div>
		{/if}
	{:else}
		<p class="text-stone-500">Sign in to view the recipe graph.</p>
	{/if}

	<div class="mt-4 flex gap-4">
		<a href="/mise/recipes/{data.currentId}" class="text-sm text-sky-700 hover:underline">
			← Back to recipe
		</a>
	</div>
</div>
