<script lang="ts">
	import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';

	let { recipeTree }: { recipeTree: RecipeTreeNode[] } = $props();

	// Set of node ids whose subtrees are collapsed. Local state — the
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

	type Row = {
		node: RecipeTreeNode;
		depth: number;
		hasChildren: boolean;
		hiddenCount: number;
	};

	function flatten(nodes: RecipeTreeNode[], depth = 0): Row[] {
		const out: Row[] = [];
		for (const node of nodes) {
			const hasChildren = node.children.length > 0;
			const row: Row = { node, depth, hasChildren, hiddenCount: 0 };
			out.push(row);
			if (hasChildren && !collapsed.has(node.id)) {
				out.push(...flatten(node.children, depth + 1));
			} else if (hasChildren) {
				row.hiddenCount = countDescendants(node);
			}
		}
		return out;
	}

	type TreeGroup = { root: RecipeTreeNode; rows: Row[] };

	// Each top-level tree becomes its own card. Index drives the alternating palette.
	let treeGroups = $derived<TreeGroup[]>(
		recipeTree.map((root) => ({
			root,
			rows: flatten([root])
		}))
	);

	// Subtle alternating backgrounds. Two tones is enough to make the seam
	// between trees obvious without being loud.
	const TREE_PALETTES = ['bg-white', 'bg-stone-50'] as const;
</script>

<div class="flex flex-col gap-3">
	<header class="flex items-center justify-between gap-3">
		<h1 class="text-xl font-semibold">Recipe List</h1>
		{#if expandableIds.length > 0}
			<div class="flex gap-2 text-sm">
				<button type="button" class="rl-btn rounded" onclick={expandAll}>Expand all</button>
				<button type="button" class="rl-btn rounded" onclick={collapseAll}>Collapse all</button>
			</div>
		{/if}
	</header>

	{#if treeGroups.length === 0}
		<p class="text-gray-600">No recipes yet.</p>
	{:else}
		<div class="flex flex-col gap-3">
			{#each treeGroups as group, i (group.root.id)}
				{@const palette = TREE_PALETTES[i % TREE_PALETTES.length]}
				<section class="overflow-hidden rounded-lg border border-gray-200 shadow-sm {palette}">
					<ul class="divide-y divide-gray-200/70">
						{#each group.rows as { node, depth, hasChildren, hiddenCount } (node.id)}
							<li
								class="group flex items-center gap-1.5 py-1 pr-3 hover:bg-black/[0.03]"
								style="padding-left: {0.5 + depth * 1.25}rem"
							>
								<button
									type="button"
									class="rl-toggle {!hasChildren ? 'invisible' : ''}"
									aria-label={collapsed.has(node.id) ? 'Expand subtree' : 'Collapse subtree'}
									aria-expanded={!collapsed.has(node.id)}
									onclick={() => toggle(node.id)}
								>
									<svg
										viewBox="0 0 20 20"
										class="h-3 w-3 transition-transform"
										class:rotate-90={!collapsed.has(node.id)}
										fill="currentColor"
										aria-hidden="true"
									>
										<path d="M7 5l6 5-6 5V5z" />
									</svg>
								</button>
								<a
									href="/recipes/{node.id}"
									class="flex-1 truncate rounded px-1.5 py-0.5 hover:underline"
								>
									{node.name}
									{#if hasChildren && hiddenCount > 0}
										<span class="ml-1 text-xs text-gray-500">({hiddenCount} more)</span>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</div>

<!--
	Global `button { @apply bg-amber-300 ... w-full ... }` lives in src/app.css
	and wins over Tailwind utilities on specificity. Scope resets below.
-->
<style>
	.rl-btn {
		background: white;
		width: auto;
		max-width: none;
		box-shadow: none;
		border: 1px solid #d1d5db;
		padding: 4px 10px;
	}
	.rl-btn:hover {
		background: #f9fafb;
	}
	.rl-toggle {
		background: transparent;
		width: 1.25rem;
		height: 1.25rem;
		max-width: none;
		box-shadow: none;
		border: none;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		color: #6b7280;
	}
	.rl-toggle:hover {
		background: rgba(0, 0, 0, 0.08);
		color: #111827;
	}
</style>
