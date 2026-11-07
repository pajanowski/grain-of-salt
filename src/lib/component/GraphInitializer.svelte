<script lang="ts">
	import { useStore, type Node, type Edge } from '@xyflow/svelte';
	import * as dagre from '@dagrejs/dagre';
	import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';
	import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';

	interface Props {
		subtree: RecipeTreeNode;
		subtreeNodes: RecipeNode[];
		currentId: string;
	}

	let { subtree, subtreeNodes, currentId }: Props = $props();

	const store = useStore();

	type FlatNode = {
		id: string;
		name: string;
		parentId: string | null;
		chain: RecipeNode[];
	};

	function flattenSubtree(node: RecipeTreeNode, parentChain: RecipeNode[] = []): FlatNode[] {
		const recipeNode = subtreeNodes.find((n) => n.id === node.id);
		if (!recipeNode) return [];
		const chain = [...parentChain, recipeNode];
		const result: FlatNode[] = [{ id: node.id, name: node.name, parentId: node.parentId, chain }];
		for (const child of node.children) result.push(...flattenSubtree(child, chain));
		return result;
	}
	let hasInitialized = false;

	const computed = $derived(_compute(subtree, currentId));

	/**
	 * Estimate a node card's rendered height from its change counts so dagre
	 * reserves enough vertical room — a fixed height makes change-heavy nodes
	 * overlap their neighbours.
	 */
	function estimateHeight(fn: FlatNode): number {
		const leaf = fn.chain[fn.chain.length - 1];
		const ing = leaf.ingredientChanges.length;
		const dir = leaf.directionChanges.length;
		let h = 80 + ing * 22 + dir * 22;
		if (ing > 0 && dir > 0) h += 18; // extra for section headers
		return h;
	}

	function _compute(tree: RecipeTreeNode, currentId: string) {
		const flat = flattenSubtree(tree);

		const g = new dagre.graphlib.Graph();
		g.setGraph({ rankdir: 'TB', nodesep: 350, ranksep: 120 });
		g.setDefaultEdgeLabel(() => ({}));

		for (const fn of flat) g.setNode(fn.id, { width: 220, height: estimateHeight(fn) });
		for (const fn of flat) {
			if (fn.parentId !== null) g.setEdge(fn.parentId, fn.id);
		}
		dagre.layout(g);

		// Horizontal stagger: shift each node within its rank a little further
		// right than its left sibling so tall cards never sit flush on top of
		// each other vertically.
		const rankOf = new Map<string, number>();
		for (const fn of flat) {
			rankOf.set(fn.id, fn.parentId === null ? 0 : (rankOf.get(fn.parentId!) ?? 0) + 1);
		}
		const staggerIndex = new Map<string, number>();
		{
			const byRank = new Map<number, FlatNode[]>();
			for (const fn of flat) {
				const rank = rankOf.get(fn.id)!;
				if (!byRank.has(rank)) byRank.set(rank, []);
				byRank.get(rank)!.push(fn);
			}
			for (const group of byRank.values()) {
				group.sort((a, b) => g.node(a.id).x - g.node(b.id).x);
				group.forEach((fn, i) => staggerIndex.set(fn.id, i));
			}
		}

		const flowNodes: Node[] = flat.map((fn) => {
			const pos = g.node(fn.id);
			const h = estimateHeight(fn);
			// The leaf of the chain holds this node's own changes
			const leaf = fn.chain[fn.chain.length - 1];
			return {
				id: fn.id,
				type: 'recipe',
				position: {
					x: pos.x - 110 + (staggerIndex.get(fn.id) ?? 0) * 60,
					y: pos.y - h / 2
				},
				data: {
					name: fn.name,
					isCurrent: fn.id === currentId,
					ingredientChanges: leaf.ingredientChanges,
					directionChanges: leaf.directionChanges
				}
			};
		});

		const flowEdges: Edge[] = flat
			.filter((fn) => fn.parentId !== null)
			.map((fn) => ({
				id: `${fn.parentId}-${fn.id}`,
				source: fn.parentId!,
				target: fn.id
			}));

		return { nodes: flowNodes, edges: flowEdges };
	}

	$effect(() => {
		if (!hasInitialized || store.nodes !== computed.nodes) {
			hasInitialized = true;
			store.nodes = computed.nodes;
			store.edges = computed.edges;
		}
	});
</script>
