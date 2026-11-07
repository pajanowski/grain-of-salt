import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';

export interface LogRow {
	node: RecipeNode;
	lane: number;
}

export interface LogEdge {
	fromLane: number;
	fromRow: number;
	toLane: number;
	toRow: number;
}

export interface LogLayout {
	rows: LogRow[];
	edges: LogEdge[];
	laneCount: number;
}

/**
 * Git-style lane assignment for a git-log --graph style rail.
 *
 * Rows are sorted newest first (like `git log`). A child is drawn before its
 * parent (newer = higher), so a child reserves its lane for its parent: the
 * parent takes the first child's lane as a straight continuation, and later
 * siblings get fresh lanes that curve-merge into the parent's lane at the
 * parent's row.
 *
 * Edges are (child lane/row → parent lane/row) pairs; the renderer draws a
 * straight vertical when lanes match, a curve otherwise.
 */
export function computeLogLayout(nodes: RecipeNode[]): LogLayout {
	const rows = [...nodes].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));

	const laneOf = new Map<string, number>();
	let nextFree = 0;
	const rowsWithLanes: LogRow[] = rows.map((node) => {
		const lane = laneOf.get(node.id) ?? nextFree++;
		if (node.parentId && !laneOf.has(node.parentId)) laneOf.set(node.parentId, lane);
		return { node, lane };
	});

	const rowIndex = new Map(rowsWithLanes.map((r, i) => [r.node.id, i]));
	const edges: LogEdge[] = [];
	for (const r of rowsWithLanes) {
		if (!r.node.parentId) continue;
		const pRow = rowIndex.get(r.node.parentId);
		if (pRow === undefined) continue; // parent not in the tree (fallback chain)
		edges.push({
			fromLane: r.lane,
			fromRow: rowIndex.get(r.node.id)!,
			toLane: rowsWithLanes[pRow].lane,
			toRow: pRow
		});
	}

	const laneCount = Math.max(0, ...rowsWithLanes.map((r) => r.lane)) + 1;
	return { rows: rowsWithLanes, edges, laneCount };
}
