import { describe, expect, it } from 'vitest';
import { computeLogLayout } from './logLayout';
import type { RecipeNode } from './RecipeNode.svelte';

function makeNode(id: string, parentId: string | null, timestamp: number): RecipeNode {
	return {
		id,
		name: `Node ${id}`,
		parentId,
		timestamp: new Date(timestamp),
		ingredientChanges: [],
		directionChanges: [],
		author: null,
		source: null,
		isPublic: false,
		isFavorite: false,
		imagePath: null,
		description: null,
		note: null
	};
}

const T = 1_000_000;

describe('computeLogLayout', () => {
	it('assigns a single lane to a straight chain', () => {
		// root → child → grandchild (newest first)
		const nodes = [
			makeNode('grandchild', 'child', T + 2),
			makeNode('child', 'root', T + 1),
			makeNode('root', null, T)
		];
		const layout = computeLogLayout(nodes);
		expect(layout.rows.map((r) => r.node.id)).toEqual(['grandchild', 'child', 'root']);
		expect(layout.rows.every((r) => r.lane === 0)).toBe(true);
		expect(layout.laneCount).toBe(1);
		expect(layout.edges).toHaveLength(2);
		// All edges are straight (same lane)
		expect(layout.edges.every((e) => e.fromLane === e.toLane)).toBe(true);
	});

	it('gives a branch a new lane and curves it into the parent', () => {
		// Simple has two children (French, Cheese); French is older
		const nodes = [
			makeNode('cheese', 'simple', T + 2), // drawn first (newest)
			makeNode('french', 'simple', T + 1),
			makeNode('simple', null, T)
		];
		const layout = computeLogLayout(nodes);
		// Cheese takes lane 0, reserves it for Simple
		expect(layout.rows[0].lane).toBe(0);
		// French gets a new lane (1)
		expect(layout.rows[1].lane).toBe(1);
		// Simple continues the first child's lane
		expect(layout.rows[2].lane).toBe(0);
		// French's edge curves from lane 1 into lane 0
		const frenchEdge = layout.edges.find((e) => e.fromLane === 1);
		expect(frenchEdge).toBeDefined();
		expect(frenchEdge!.toLane).toBe(0);
	});

	it('handles a multi-generation branch with a fork in the middle', () => {
		// Simple → {French, Cheese}; Cheese → Denver
		const nodes = [
			makeNode('denver', 'cheese', T + 4),
			makeNode('cheese', 'simple', T + 3),
			makeNode('french', 'simple', T + 2),
			makeNode('simple', null, T)
		];
		const layout = computeLogLayout(nodes);
		// Denver, Cheese, Simple all on lane 0 (straight continuation)
		expect(layout.rows[0].lane).toBe(0);
		expect(layout.rows[1].lane).toBe(0);
		expect(layout.rows[3].lane).toBe(0);
		// French branches off at lane 1
		expect(layout.rows[2].lane).toBe(1);
		expect(layout.rows[2].node.id).toBe('french');
		const frenchEdge = layout.edges.find((e) => e.fromLane === 1);
		expect(frenchEdge!.toLane).toBe(0);
		expect(frenchEdge!.toRow).toBe(3);
	});

	it('sorts rows newest first', () => {
		const nodes = [
			makeNode('root', null, T),
			makeNode('child', 'root', T + 1)
		];
		const layout = computeLogLayout(nodes);
		expect(layout.rows.map((r) => r.node.id)).toEqual(['child', 'root']);
	});

	it('skips edges whose parent is missing from the tree', () => {
		const nodes = [makeNode('orphan', 'missing-parent', T)];
		const layout = computeLogLayout(nodes);
		expect(layout.edges).toHaveLength(0);
		expect(layout.rows).toHaveLength(1);
	});
});

describe('computeLogLayout — bouillabaisse-shaped tree', () => {
	// Imported root → weeknight → rouille → {one-pot, spicy} → provencal → for-two
	// A chain of 5 below the root with a fork at rouille's level.
	it('forks into two lanes and re-merges for the main chain', () => {
		const nodes = [
			makeNode('for-two', 'provencal', T + 6),
			makeNode('provencal', 'spicy', T + 5),
			makeNode('spicy', 'rouille', T + 4),
			makeNode('one-pot', 'rouille', T + 3),
			makeNode('rouille', 'weeknight', T + 2),
			makeNode('weeknight', 'root', T + 1),
			makeNode('root', null, T)
		];
		const layout = computeLogLayout(nodes);
		// Newest first
		expect(layout.rows.map((r) => r.node.id)).toEqual([
			'for-two',
			'provencal',
			'spicy',
			'one-pot',
			'rouille',
			'weeknight',
			'root'
		]);
		// Main chain: for-two, provencal, spicy, rouille, weeknight, root all on lane 0
		expect(layout.rows[0].lane).toBe(0);
		expect(layout.rows[1].lane).toBe(0);
		expect(layout.rows[2].lane).toBe(0);
		expect(layout.rows[4].lane).toBe(0);
		expect(layout.rows[5].lane).toBe(0);
		expect(layout.rows[6].lane).toBe(0);
		// one-pot forks off to lane 1
		expect(layout.rows[3].lane).toBe(1);
		const onePotEdge = layout.edges.find((e) => e.fromLane === 1);
		expect(onePotEdge).toBeDefined();
		expect(onePotEdge!.toLane).toBe(0);
		expect(onePotEdge!.toRow).toBe(4);
		// Only one lane was needed
		expect(layout.laneCount).toBe(2);
	});
});
