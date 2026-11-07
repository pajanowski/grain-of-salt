<script lang="ts">
	import { untrack } from 'svelte';
	import { useStore, type Node, type Edge } from '@xyflow/svelte';
	import * as dagre from '@dagrejs/dagre';
	import { resolveTops } from '$lib/obj/graphLayout';
	import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';
	import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';

	interface Props {
		subtree: RecipeTreeNode;
		subtreeNodes: RecipeNode[];
		currentId: string;
		/** Called once the final (measured) layout is in the store. */
		onMeasured?: () => void;
	}

	let { subtree, subtreeNodes, currentId, onMeasured }: Props = $props();

	const store = useStore();

	// Minimum vertical gap between a card's bottom and its children's tops.
	// Also the dagre ranksep; see resolveTops below.
	const RANK_GAP = 120;
	const SLOT = 240; // card width 220 + gap
	// Placeholder y for the measurement pass: far off-screen, so the hidden
	// mount never flashes a mis-sized layout.
	const MEASURE_Y = -1_000_000;

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

	/**
	 * Estimate a node card's rendered height from its change counts. A lower
	 * bound: direction bodies (with raw #<uuid> ingredient refs) wrap into far
	 * more lines than this assumes, so real cards run much taller. Used only
	 * for the off-screen measurement placeholder and as a fallback if the
	 * cards never render.
	 */
	function estimateHeight(fn: FlatNode): number {
		const leaf = fn.chain[fn.chain.length - 1];
		const ing = leaf.ingredientChanges.length;
		const dir = leaf.directionChanges.length;
		let h = 80 + ing * 22 + dir * 22;
		if (ing > 0 && dir > 0) h += 18; // extra for section headers
		return h;
	}

	function _compute(
		tree: RecipeTreeNode,
		heightOf: (fn: FlatNode) => number,
		yOf?: (id: string) => number
	): { nodes: Node[]; edges: Edge[] } {
		const flat = flattenSubtree(tree);

		const g = new dagre.graphlib.Graph();
		g.setGraph({ rankdir: 'TB', ranksep: RANK_GAP });
		g.setDefaultEdgeLabel(() => ({}));

		for (const fn of flat) g.setNode(fn.id, { width: 220, height: heightOf(fn) });
		for (const fn of flat) {
			if (fn.parentId !== null) g.setEdge(fn.parentId, fn.id);
		}
		dagre.layout(g);

		// Vertical layout: dagre's ranksep is a centre-to-centre distance, so
		// a tall card can overlap its child. resolveTops pushes each subtree
		// down until every child's top is strictly below its parent's bottom.
		// Safe because every node owns a disjoint x slot (below), so a
		// vertical push can never collide with another subtree.
		const dagreNode = (id: string) => g.node(id);
		const tops = resolveTops(
			tree,
			(id) => dagreNode(id).y - dagreNode(id).height / 2,
			(id) => dagreNode(id).height,
			RANK_GAP
		);

		// Horizontal layout: depth-first walk. Every node takes the next free
		// slot (cursor advances past the card's width), so a child always sits
		// to the right of its parent, and a subtree's last leaf reserves the
		// x where the next sibling subtree starts — no two cards can share an
		// x range.
		const xOf = new Map<string, number>();
		let cursor = 0;
		const visit = (node: RecipeTreeNode) => {
			xOf.set(node.id, cursor);
			cursor += SLOT;
			for (const child of node.children) visit(child);
		};
		visit(tree);

		const flowNodes: Node[] = flat.map((fn) => {
			// The leaf of the chain holds this node's own changes
			const leaf = fn.chain[fn.chain.length - 1];
			return {
				id: fn.id,
				type: 'recipe',
				position: {
					x: xOf.get(fn.id) ?? 0,
					y: yOf ? yOf(fn.id) : tops.get(fn.id) ?? 0
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

	// Placeholder layout: off-screen positions, estimated heights.
	const placeholder = $derived(_compute(subtree, estimateHeight, () => MEASURE_Y));

	// Final layout: real card heights, null until the cards have rendered.
	let measuredHeights = $state<Map<string, number> | null>(null);
	const layout = $derived.by(() => {
		const mh = measuredHeights;
		return mh ? _compute(subtree, (fn) => mh.get(fn.id) ?? estimateHeight(fn)) : placeholder;
	});

	$effect(() => {
		store.nodes = layout.nodes;
		store.edges = layout.edges;
	});

	// Measure the rendered cards, then re-layout with the real heights so the
	// "child top below parent bottom" invariant holds against rendered
	// pixels, not the estimate. One pass is stable: card content is static,
	// the width is fixed at 220px, and the app uses system fonts (no FOUT
	// reflow). If the cards never render, fall back to the estimate.
	$effect(() => {
		const expected = placeholder.nodes.length;
		// untrack: measuredHeights must not be a dependency. Setting it below
		// would re-run this effect and fire its cleanup, cancelling the very
		// async pass that is about to call onMeasured — `ready` in
		// RecipeGraph.svelte then never flips, the container stays
		// visibility:hidden, and the edges (which, unlike the node wrappers,
		// inherit visibility) go invisible.
		if (untrack(() => measuredHeights) !== null) return;
		let cancelled = false;
		(async () => {
			for (let i = 0; i < 10; i++) {
				await new Promise((r) => requestAnimationFrame(r));
				if (cancelled) return;
				const heights = new Map<string, number>();
				for (const el of document.querySelectorAll<HTMLElement>('.svelte-flow__node[data-id]')) {
					const card = el.querySelector<HTMLElement>('[data-testid="recipe-node-card"]');
					if (card) heights.set(el.dataset.id!, card.offsetHeight);
				}
				if (heights.size === expected && expected > 0) {
					measuredHeights = heights;
					// Let SvelteFlow process the new positions, then fit.
					await new Promise((r) => requestAnimationFrame(r));
					if (cancelled) return;
					onMeasured?.();
					await store.fitView({ padding: 0.2 });
					return;
				}
			}
			if (!cancelled) {
				measuredHeights = new Map();
				onMeasured?.();
			}
		})();
		return () => {
			cancelled = true;
		};
	});
</script>
