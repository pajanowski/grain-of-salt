<script lang="ts">
	import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';

	let {
		recipeTree,
		searchQuery = $bindable('')
	}: { recipeTree: RecipeTreeNode[]; searchQuery?: string } = $props();

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

	function nameMatches(node: RecipeTreeNode, q: string): boolean {
		return node.name.toLowerCase().includes(q);
	}

	// Keep a node if its name matches OR any descendant matches; rebuild
	// `children` with only the surviving branch so the rendered tree stays
	// connected to its visible ancestors.
	function filterTree(nodes: RecipeTreeNode[], q: string): RecipeTreeNode[] {
		if (!q) return nodes;
		const out: RecipeTreeNode[] = [];
		for (const node of nodes) {
			const filteredChildren = filterTree(node.children, q);
			if (nameMatches(node, q) || filteredChildren.length > 0) {
				out.push({
					id: node.id,
					name: node.name,
					parentId: node.parentId,
					children: filteredChildren
				});
			}
		}
		return out;
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

	// Case-insensitive trim of the query. Empty string disables filtering.
	let normalizedQuery = $derived(searchQuery.trim().toLowerCase());

	let filteredTree = $derived<RecipeTreeNode[]>(filterTree(recipeTree, normalizedQuery));

	let expandableIds = $derived(collectIdsWithChildren(filteredTree));

	function expandAll() {
		collapsed = new Set();
	}

	function collapseAll() {
		collapsed = new Set(expandableIds);
	}

	// Each top-level tree becomes its own card. Index drives the alternating palette.
	let treeGroups = $derived<TreeGroup[]>(
		filteredTree.map((root) => ({
			root,
			rows: flatten([root])
		}))
	);

	// Subtle alternating backgrounds. Two tones is enough to make the seam
	// between trees obvious without being loud.
	const TREE_PALETTES = ['bg-white', 'bg-stone-50'] as const;

	let searchInputEl = $state<HTMLInputElement | null>(null);
	export function focusSearch() {
		searchInputEl?.focus();
		searchInputEl?.select();
	}
</script>

<div class="flex flex-col gap-3">
	<header class="flex items-center justify-between gap-3">
		<h1 class="text-xl font-semibold">Recipe List</h1>
		<div class="flex gap-1">
			<button type="button" class="rl-btn rounded" onclick={expandAll} aria-label="Expand all">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-4 w-4"
					aria-hidden="true"
				>
					<polyline points="15 3 21 3 21 9" />
					<polyline points="9 21 3 21 3 15" />
					<line x1="21" x2="14" y1="3" y2="10" />
					<line x1="3" x2="10" y1="21" y2="14" />
				</svg>
			</button>
			<button type="button" class="rl-btn rounded" onclick={collapseAll} aria-label="Collapse all">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-4 w-4"
					aria-hidden="true"
				>
					<polyline points="4 14 10 14 10 20" />
					<polyline points="20 10 14 10 14 4" />
					<line x1="14" x2="21" y1="3" y2="10" />
					<line x1="3" x2="10" y1="21" y2="14" />
				</svg>
			</button>
		</div>
	</header>

	<input
		bind:this={searchInputEl}
		bind:value={searchQuery}
		type="search"
		placeholder="Search recipes…"
		aria-label="Search recipes"
		class="rl-search"
	/>

	{#if treeGroups.length === 0}
		<p class="text-gray-600">{normalizedQuery ? 'No matches.' : 'No recipes yet.'}</p>
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
									href="/mise/recipes/{node.id}"
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
	/* Override the global input rule for this scoped input. */
	.rl-search {
		font-size: 0.875rem;
	}
</style>
