<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import type { Ingredient, Direction } from '$lib/obj/Recipe.svelte';
	type NodeData = {
		name: string;
		isCurrent: boolean;
		ingredients: Ingredient[];
		directions: Direction[];
	};

	type Props = NodeProps & { data: NodeData };

	let { data }: Props = $props();
</script>

<div
	class="rounded border bg-stone-50 px-3 py-2 font-sans text-xs"
	class:border-sky-700={data.isCurrent}
	class:border-stone-400={!data.isCurrent}
	class:bg-sky-50={data.isCurrent}
	style:border-width={data.isCurrent ? '2px' : '1px'}
	style:width="200px"
>
	<Handle type="target" position={Position.Top} />

	<div class="mb-1 text-[13px] font-bold text-stone-900">
		{data.name}
	</div>

	{#if data.ingredients.length > 0}
		<div class="mt-1">
			<div class="mb-0.5 text-[10px] font-semibold text-stone-500">INGREDIENTS</div>
			{#each data.ingredients as i (i.id)}
				<div class="text-stone-700">
					{i.amount || ''} {i.unit || ''} {i.name || ''}
				</div>
			{/each}
		</div>
	{/if}

	{#if data.directions.length > 0}
		<div class="mt-1">
			<div class="mb-0.5 text-[10px] font-semibold text-stone-500">DIRECTIONS</div>
			{#each data.directions as d (d.id)}
				<div class="text-stone-700">{d.body}</div>
			{/each}
		</div>
	{/if}

	{#if data.ingredients.length === 0 && data.directions.length === 0}
		<div class="italic text-stone-400">No changes</div>
	{/if}

	<Handle type="source" position={Position.Bottom} />
</div>
