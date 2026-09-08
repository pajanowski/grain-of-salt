<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import type { IngredientChange, DirectionChange } from '$lib/obj/RecipeNode.svelte';

	type NodeData = {
		name: string;
		isCurrent: boolean;
		ingredientChanges: IngredientChange[];
		directionChanges: DirectionChange[];
	};

	type Props = NodeProps & { data: NodeData };

	let { data }: Props = $props();

	function changeBg(changeType: string): string {
		if (changeType === 'add') return '#dcfce7'; // green-100
		if (changeType === 'remove') return '#fee2e2'; // red-100
		return '#fef3c7'; // amber-100
	}

	function changeLabel(changeType: string): string {
		if (changeType === 'add') return 'ADD';
		if (changeType === 'remove') return 'REMOVE';
		return 'EDIT';
	}

	function changeText(c: IngredientChange): string {
		if (!c.body) return '';
		return `${c.body.amount || ''} ${c.body.unit || ''} ${c.body.name || ''}`.trim();
	}

	function directionText(c: DirectionChange): string {
		return c.body?.body ?? '';
	}
</script>

<div
	class="rounded border bg-stone-50 px-3 py-2 font-sans text-xs"
	class:border-sky-700={data.isCurrent}
	class:border-stone-400={!data.isCurrent}
	class:bg-sky-50={data.isCurrent}
	style:border-width={data.isCurrent ? '2px' : '1px'}
	style:width="220px"
>
	<Handle type="target" position={Position.Top} />

	<div class="mb-1 text-[13px] font-bold text-stone-900">
		{data.name}
	</div>

	{#if data.ingredientChanges.length > 0}
		<div class="mt-1">
			<div class="mb-0.5 text-[10px] font-semibold text-stone-500">INGREDIENTS</div>
			{#each data.ingredientChanges as c (c.id)}
				<div class="mb-0.5 rounded px-1 py-0.5" style:background-color={changeBg(c.changeType)}>
					<span class="mr-1 font-mono text-[9px] font-bold uppercase">{changeLabel(c.changeType)}</span>
					<span class="text-stone-700">{changeText(c)}</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if data.directionChanges.length > 0}
		<div class="mt-1">
			<div class="mb-0.5 text-[10px] font-semibold text-stone-500">DIRECTIONS</div>
			{#each data.directionChanges as c (c.id)}
				<div class="mb-0.5 rounded px-1 py-0.5" style:background-color={changeBg(c.changeType)}>
					<span class="mr-1 font-mono text-[9px] font-bold uppercase">{changeLabel(c.changeType)}</span>
					<span class="text-stone-700">{directionText(c)}</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if data.ingredientChanges.length === 0 && data.directionChanges.length === 0}
		<div class="italic text-stone-400">No changes</div>
	{/if}

	<Handle type="source" position={Position.Bottom} />
</div>
