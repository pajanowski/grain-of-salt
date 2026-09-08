<script lang="ts">
	import { useStore, type Node, type Edge } from '@xyflow/svelte';
	import * as dagre from '@dagrejs/dagre';
	import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';
	import type {
		RecipeNode,
		IngredientChange,
		DirectionChange
	} from '$lib/obj/RecipeNode.svelte';
	import type { Ingredient, Direction } from '$lib/obj/Recipe.svelte';

	interface Props {
		subtree: RecipeTreeNode;
		subtreeNodes: RecipeNode[];
		currentId: string;
	}

	let { subtree, subtreeNodes, currentId }: Props = $props();

	const store = useStore();

	function applyNodes(
		nodes: RecipeNode[]
	): { ingredients: Ingredient[]; directions: Direction[] } {
		const im = new Map<string, Ingredient>();
		const dm = new Map<string, Direction>();
		for (const node of nodes) {
			for (const change of node.ingredientChanges) applyIngredientChange(im, change);
			for (const change of node.directionChanges) applyDirectionChange(dm, change);
		}
		return {
			ingredients: [...im.values()],
			directions: [...dm.values()]
		};
	}

	function applyIngredientChange(m: Map<string, Ingredient>, change: IngredientChange): void {
		if (change.changeType === 'add') m.set(change.id, change.body!);
		else if (change.changeType === 'edit') {
			const ex = m.get(change.targetId!);
			if (ex) m.set(change.targetId!, { ...ex, ...change.body! });
		} else if (change.changeType === 'remove') m.delete(change.targetId!);
	}

	function applyDirectionChange(m: Map<string, Direction>, change: DirectionChange): void {
		if (change.changeType === 'add') m.set(change.id, change.body!);
		else if (change.changeType === 'edit') {
			const ex = m.get(change.targetId!);
			if (ex) m.set(change.targetId!, { ...ex, ...change.body! });
		} else if (change.changeType === 'remove') m.delete(change.targetId!);
	}

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

	const computed = $derived(_compute(subtree, subtreeNodes, currentId));

	function _compute(tree: RecipeTreeNode, nodes: RecipeNode[], currentId: string) {
		const flat = flattenSubtree(tree);

		const g = new dagre.graphlib.Graph();
		g.setGraph({ rankdir: 'TB', nodesep: 350, ranksep: 120 });
		g.setDefaultEdgeLabel(() => ({}));

		for (const fn of flat) g.setNode(fn.id, { width: 200, height: 180 });
		for (const fn of flat) {
			if (fn.parentId !== null) g.setEdge(fn.parentId, fn.id);
		}
		dagre.layout(g);

		const flowNodes: Node[] = flat.map((fn) => {
			const pos = g.node(fn.id);
			const state = applyNodes(fn.chain);
			return {
				id: fn.id,
				type: 'recipe',
				position: { x: pos.x - 110, y: pos.y - 90 },
				data: {
					name: fn.name,
					isCurrent: fn.id === currentId,
					ingredients: state.ingredients,
					directions: state.directions
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
