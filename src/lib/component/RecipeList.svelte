<script lang="ts">
	import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';

	let { recipeTree }: { recipeTree: RecipeTreeNode[] } = $props();

	// Set of root node ids whose subtrees are collapsed. Local state — the
	// tree resets on full reload, which is fine for a list view.
	let collapsed = $state<Set<string>>(new Set());

	function toggle(id: string) {
		const next = new Set(collapsed);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		collapsed = next;
	}

	function collectIdsWithChildren(nodes: RecipeTreeNode[]): string[] {
		const out: string[] = [];
		for (const node of nodes) {
			if (node.children.length > 0) {
				out.push(node.id);
				out.push(...collectIdsWithChildren(node.children));
			}
		}
		return out;
	}

	let expandableIds = $derived(collectIdsWithChildren(recipeTree));

	function expandAll() {
		collapsed = new Set();
	}

	function collapseAll() {
		collapsed = new Set(expandableIds);
	}

	function countDescendants(node: RecipeTreeNode): number {
		let n = 0;
		for (const child of node.children) {
			n += 1 + countDescendants(child);
		}
		return n;
	}

	/**
	 * Flatten the tree, skipping children of any node in `collapsed`. Each
	 * row carries enough info for the renderer to decide whether to show a
	 * toggle and how to indent.
	 */
	function flatten(
		nodes: RecipeTreeNode[],
		depth = 0,
	): Array<{ node: RecipeTreeNode; depth: number; hasChildren: boolean; hiddenCount: number }> {
		const out: Array<{ node: RecipeTreeNode; depth: number; hasChildren: boolean; hiddenCount: number }> = [];
		for (const node of nodes) {
			const hasChildren = node.children.length > 0;
			out.push({ node, depth, hasChildren, hiddenCount: 0 });
			if (hasChildren && !collapsed.has(node.id)) {
				for (const row of flatten(node.children, depth + 1)) {
					out.push(row);
				}
			} else if (hasChildren) {
				// The current row's hiddenCount is the descendants it would
				// show if expanded. Annotate the row above (already pushed).
				out[out.length - 1].hiddenCount = countDescendants(node);
			}
		}
		return out;
	}

	let rows = $derived(flatten(recipeTree));
</script>

<div class="flex flex-col">
	<h1><a href="/">Recipe List</a></h1>

	{#if expandableIds.length > 0}
		<div class="flex gap-2 mb-2 text-sm">
			<button
				type="button"
				class="px-2 py-1 rounded border hover:bg-gray-100"
				onclick={expandAll}
			>
				Expand all
			</button>
			<button
				type="button"
				class="px-2 py-1 rounded border hover:bg-gray-100"
				onclick={collapseAll}
			>
				Collapse all
			</button>
		</div>
	{/if}

	{#if rows.length === 0}
		<p>No recipes yet.</p>
	{:else}
		<ul class="list-none p-0">
			{#each rows as { node, depth, hasChildren, hiddenCount } (node.id)}
				<li
					class="flex flex-row justify-between items-center gap-2"
					style="padding-left: {depth * 1.25}rem"
				>
					<a href="/recipes/{node.id}" class="flex-1">
						{depth > 0 ? '↳ ' : ''}{node.name}
						{#if hasChildren && hiddenCount > 0}
							<span class="opacity-50 text-sm">({hiddenCount})</span>
						{/if}
					</a>

					{#if hasChildren}
						<button
							type="button"
							class="w-6 h-6 inline-flex items-center justify-center text-sm rounded hover:bg-gray-100"
							aria-label={collapsed.has(node.id) ? 'Expand subtree' : 'Collapse subtree'}
							aria-expanded={!collapsed.has(node.id)}
							onclick={() => toggle(node.id)}
						>
							{collapsed.has(node.id) ? '▸' : '�'}
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
