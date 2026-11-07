<script lang="ts">
	import { SvelteFlow, SvelteFlowProvider, type Node } from '@xyflow/svelte';
	import RecipeNodeCard from '$lib/component/RecipeNodeCard.svelte';
	import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';
	import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
	import GraphInitializer from '$lib/component/GraphInitializer.svelte';
	interface Props {
		subtree: RecipeTreeNode;
		subtreeNodes: RecipeNode[];
		currentId: string;
	}

	let { subtree, subtreeNodes, currentId }: Props = $props();

	const nodeTypes = { recipe: RecipeNodeCard };

	function handleNodeClick(event: { node: Node }) {
		window.location.href = `/mise/recipes/${event.node.id}`;
	}

	// Hide the flow until the measured (final) layout is in place, so the
	// off-screen measurement placeholder never flashes. Re-hides when the
	// tree changes (the keyed flow below remounts and re-measures).
	let ready = $state(false);
	$effect(() => {
		subtree.id;
		ready = false;
	});
</script>

{#key subtree.id}
	<div
		class="h-[600px] w-full rounded border border-stone-300"
		style:visibility={ready ? 'visible' : 'hidden'}
	>
		<SvelteFlowProvider>
			<SvelteFlow
				{nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.2 }}
				minZoom={0.1}
				maxZoom={2}
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable={false}
				onnodeclick={handleNodeClick}
			/>
			<GraphInitializer
				{subtree}
				{subtreeNodes}
				{currentId}
				onMeasured={() => (ready = true)}
			/>
		</SvelteFlowProvider>
	</div>
{/key}
