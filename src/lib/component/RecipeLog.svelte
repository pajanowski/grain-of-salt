<script lang="ts">
	import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
	import { formatRelativeTime } from '$lib/formatDate';
	import { computeLogLayout, type LogEdge } from '$lib/obj/logLayout';

	interface Props {
		nodes: RecipeNode[];
		currentId: string;
	}

	let { nodes, currentId }: Props = $props();

	// Rail geometry (px)
	const ROW_H = 56;
	const COL_W = 28;
	const DOT_R = 6;

	// Lane colors cycle through the branch lines, like git's --graph rainbow.
	const LANE_COLORS = [
		'#f59e0b', // amber
		'#0ea5e9', // sky
		'#10b981', // emerald
		'#8b5cf6', // violet
		'#f43f5e', // rose
		'#14b8a6', // teal
		'#eab308', // yellow
		'#6366f1' // indigo
	];

	function laneColor(lane: number): string {
		return LANE_COLORS[lane % LANE_COLORS.length];
	}

	const layout = $derived(computeLogLayout(nodes));

	const railWidth = $derived(layout.laneCount * COL_W);

	function edgePath(e: LogEdge): string {
		const fx = e.fromLane * COL_W + COL_W / 2;
		const fy = e.fromRow * ROW_H + ROW_H / 2;
		const tx = e.toLane * COL_W + COL_W / 2;
		const ty = e.toRow * ROW_H + ROW_H / 2;
		if (e.fromLane === e.toLane) {
			return `M ${fx} ${fy} L ${tx} ${ty}`;
		}
		// Vertical down to just above the parent's row, then a smooth curve
		// merging into the parent's lane.
		const elbow = ty - 16;
		return `M ${fx} ${fy} L ${fx} ${elbow} Q ${fx} ${ty} ${tx} ${ty}`;
	}

	function summary(node: RecipeNode): string {
		const ing = node.ingredientChanges.length;
		const dir = node.directionChanges.length;
		if (ing === 0 && dir === 0) return 'no changes';
		const parts: string[] = [];
		if (ing > 0) parts.push(ing === 1 ? '1 ingredient' : `${ing} ingredients`);
		if (dir > 0) parts.push(dir === 1 ? '1 direction' : `${dir} directions`);
		return parts.join(', ');
	}
</script>

<div class="rounded border border-stone-300 bg-white">
	{#if layout.rows.length === 0}
		<div class="p-6 text-center text-stone-400">No history to show.</div>
	{:else}
		<div class="relative">
			<svg
				aria-hidden="true"
				width={railWidth}
				height={layout.rows.length * ROW_H}
				class="absolute left-0 top-0"
			>
				{#each layout.edges as e}
					<path
						d={edgePath(e)}
						stroke={laneColor(e.toLane)}
						fill="none"
						stroke-width="2"
						stroke-linecap="round"
					/>
				{/each}
				{#each layout.rows as r, i}
					<circle
						cx={r.lane * COL_W + COL_W / 2}
						cy={i * ROW_H + ROW_H / 2}
						r={r.node.id === currentId ? DOT_R + 2 : DOT_R}
						fill={laneColor(r.lane)}
						stroke={r.node.id === currentId ? '#fde68a' : 'none'}
						stroke-width={r.node.id === currentId ? 3 : 0}
					/>
				{/each}
			</svg>
			{#each layout.rows as r, i (r.node.id)}
				<a
					href="/mise/recipes/{r.node.id}"
					style="height: {ROW_H}px; margin-left: {railWidth + 12}px"
					class="flex items-center gap-3 border-b border-stone-100 pr-4 transition-colors {r.node.id === currentId
						? 'bg-amber-50'
						: 'hover:bg-stone-50'}"
					data-testid="log-row"
				>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="truncate font-semibold text-stone-800">{r.node.name}</span>
							{#if r.node.id === currentId}
								<span class="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">current</span>
							{/if}
						</div>
						<div class="truncate text-xs text-stone-500">
							{r.node.author ?? 'Unknown'}
							· {formatRelativeTime(r.node.timestamp)}
							· {summary(r.node)}
						</div>
					</div>
					<code class="shrink-0 text-xs text-stone-400">{r.node.id.slice(0, 7)}</code>
				</a>
			{/each}
		</div>
	{/if}
</div>
