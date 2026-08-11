<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';

	let { recipeTree }: { recipeTree: RecipeTreeNode[] } = $props();

	function flatten(
		node: RecipeTreeNode,
		depth = 0
	): Array<{ node: RecipeTreeNode; depth: number }> {
		const out = [{ node, depth }];
		for (const child of node.children) {
			out.push(...flatten(child, depth + 1));
		}
		return out;
	}

	let rows = $derived(recipeTree.flatMap((n) => flatten(n)));
</script>

<div class="flex flex-col">
	<h1><a href="/">Recipe List</a></h1>

	{#if rows.length === 0}
		<p>No recipes yet.</p>
	{:else}
		<ul class="list-none p-0">
			{#each rows as { node, depth } (node.id)}
				<li
					class="flex flex-row justify-between items-center"
					style="padding-left: {depth * 1.25}rem"
				>
					<a href="/recipes/{node.id}">
						{depth > 0 ? '↳ ' : ''}{node.name}
					</a>
					<!-- <button -->
					<!-- 	onclick={async () => { -->
					<!-- 		if (window.confirm(`Delete ${node.name}`)) { -->
					<!-- 			await fetch(`/api/recipe/${node.id}`, { -->
					<!-- 				method: 'DELETE' -->
					<!-- 			}); -->
					<!-- 			invalidateAll(); -->
					<!-- 		} -->
					<!-- 	}}>Delete</button -->
					<!-- > -->
				</li>
			{/each}
		</ul>
	{/if}
</div>
