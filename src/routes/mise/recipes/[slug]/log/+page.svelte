<script lang="ts">
	import { browser } from '$app/environment';
	import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';
	import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
	import { isDemoMode } from '$lib/demo-init';
	import { demoStore, demoNodes } from '$lib/recipe-store.demo';
	import { page } from '$app/state';
	import RecipeLog from '$lib/component/RecipeLog.svelte';

	const { data } = $props();

	let demoGraph = $state<{ subtree: RecipeTreeNode | null; subtreeNodes: RecipeNode[] } | null>(null);

	$effect(() => {
		if (data.demoMode || isDemoMode) {
			const slug = page.params.slug;
			if (slug) {
				const unsub = demoNodes.subscribe(async () => {
					const graph = await demoStore.getGraphView(slug);
					if (graph) {
						demoGraph = graph;
					}
				});
				return () => unsub();
			}
		}
	});

	let subtreeNodes = $derived(
		(demoGraph ? demoGraph.subtreeNodes : data.subtreeNodes) as RecipeNode[]
	);
	let currentId = $derived(data.currentId as string);
</script>

<div class="mx-auto max-w-4xl px-4 py-6">
	<div class="mb-4 flex items-center gap-3">
		<a href="/mise/recipes/{data.currentId}" class="text-stone-400 hover:text-stone-600" title="Back to recipe">
			<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
			</svg>
		</a>
		<h1 class="text-2xl font-bold text-stone-800">Recipe Log</h1>
	</div>

	{#if subtreeNodes.length > 0}
		<RecipeLog nodes={subtreeNodes} {currentId} />
	{:else if data.demoMode || isDemoMode}
		<p class="text-stone-500">Recipe log not found.</p>
	{:else}
		<p class="text-stone-500">Sign in to view the recipe log.</p>
	{/if}

	<div class="mt-4 flex gap-4">
		<a href="/mise/recipes/{data.currentId}" class="text-sm text-sky-700 hover:underline">
			← Back to recipe
		</a>
	</div>
</div>
