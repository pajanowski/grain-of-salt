import { describe, it, expect } from 'vitest';
import { resolveTops } from './graphLayout';
import type { RecipeTreeNode } from '$lib/server/bo/recipenodesbo';

function node(id: string, children: RecipeTreeNode[] = []): RecipeTreeNode {
	return { id, name: id, parentId: null, children };
}

describe('resolveTops', () => {
	it('keeps base tops that already satisfy the invariant', () => {
		const tree = node('a', [node('b')]);
		const tops = resolveTops(tree, (id) => (id === 'a' ? 0 : 300), () => 100, 40);
		expect(tops.get('a')).toBe(0);
		expect(tops.get('b')).toBe(300); // 300 > 0 + 100 + 40, untouched
	});

	it('pushes a child below a tall parent', () => {
		const tree = node('a', [node('b')]);
		// dagre-style base: child centre only 120px below parent centre.
		const tops = resolveTops(tree, (id) => (id === 'a' ? 0 : 20), () => 600, 120);
		expect(tops.get('a')).toBe(0);
		expect(tops.get('b')).toBe(600 + 120); // strictly below parent bottom
	});

	it('cascades pushes down a chain', () => {
		const tree = node('a', [node('b', [node('c')])]);
		const tops = resolveTops(tree, () => 0, () => 100, 40);
		expect(tops.get('a')).toBe(0);
		expect(tops.get('b')).toBe(140);
		expect(tops.get('c')).toBe(280);
	});

	it('pushes every forked child below the parent, independently', () => {
		const tree = node('a', [node('b'), node('c')]);
		const tops = resolveTops(tree, () => 10, () => 200, 50);
		expect(tops.get('a')).toBe(10);
		expect(tops.get('b')).toBe(260);
		expect(tops.get('c')).toBe(260);
	});

	it('keeps the invariant on a forked tree with mismatched heights', () => {
		const tree = node('r', [node('a', [node('a1'), node('a2', [node('a2x')])]), node('b')]);
		const heights: Record<string, number> = {
			r: 500,
			a: 100,
			a1: 30,
			a2: 400,
			a2x: 20,
			b: 60
		};
		const tops = resolveTops(tree, () => 0, (id) => heights[id], 120);
		const check = (n: RecipeTreeNode): void => {
			const bottom = (tops.get(n.id) as number) + heights[n.id];
			for (const c of n.children) {
				expect(tops.get(c.id)).toBeGreaterThan(bottom);
				check(c);
			}
		};
		check(tree);
	});
});
