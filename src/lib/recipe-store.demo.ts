import { writable, get, type Writable } from 'svelte/store';
import type {
	RecipeStore,
	RecipeTreeNode,
	RecipeDashboardItem,
	RecipeFavoriteItem,
	RecipeDetailView,
	RecipeGraphView,
	RecipeSummary
} from './recipe-store';
import type { RecipeNode, IngredientChange, DirectionChange } from './obj/RecipeNode.svelte';
import { SEED_RECIPES, SEED_NODES } from './demo-seed';
import { applyNodes } from './recipe-apply';

function cloneSeedNodes(): Map<string, RecipeNode> {
	const map = new Map<string, RecipeNode>();
	for (const node of SEED_NODES) {
		map.set(node.id, {
			...node,
			timestamp: new Date(node.timestamp),
			ingredientChanges: JSON.parse(JSON.stringify(node.ingredientChanges)),
			directionChanges: JSON.parse(JSON.stringify(node.directionChanges))
		});
	}
	return map;
}

function loadInitialState(): { recipes: RecipeSummary[]; nodes: Map<string, RecipeNode> } {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return { recipes: [...SEED_RECIPES], nodes: cloneSeedNodes() };
	}

	try {
		const rawRecipes = localStorage.getItem('demo:recipes');
		const rawNodes = localStorage.getItem('demo:nodes');

		if (rawRecipes && rawNodes) {
			const parsedRecipes: RecipeSummary[] = JSON.parse(rawRecipes);
			const parsedNodeEntries: [string, RecipeNode][] = JSON.parse(rawNodes);
			const nodeMap = new Map<string, RecipeNode>();

			for (const [id, node] of parsedNodeEntries) {
				nodeMap.set(id, {
					...node,
					timestamp: new Date(node.timestamp)
				});
			}

			if (nodeMap.size > 0) {
				return { recipes: parsedRecipes, nodes: nodeMap };
			}
		}
	} catch {
		// Ignore corrupted local storage and re-seed
	}

	const defaultNodes = cloneSeedNodes();
	const defaultRecipes = [...SEED_RECIPES];
	persist(defaultRecipes, defaultNodes);
	return { recipes: defaultRecipes, nodes: defaultNodes };
}

function persist(recipes: RecipeSummary[], nodes: Map<string, RecipeNode>) {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem('demo:recipes', JSON.stringify(recipes));
		localStorage.setItem('demo:nodes', JSON.stringify(Array.from(nodes.entries())));
	} catch {
		// Ignore quota exceeded
	}
}

const initial = loadInitialState();
export const demoRecipes: Writable<RecipeSummary[]> = writable(initial.recipes);
export const demoNodes: Writable<Map<string, RecipeNode>> = writable(initial.nodes);

export function resetDemoState(): void {
	const defaultNodes = cloneSeedNodes();
	const defaultRecipes = [...SEED_RECIPES];
	demoNodes.set(defaultNodes);
	demoRecipes.set(defaultRecipes);
	persist(defaultRecipes, defaultNodes);
}

function getDescendantIds(nodes: Map<string, RecipeNode>, rootId: string): Set<string> {
	const result = new Set<string>([rootId]);
	let added = true;
	while (added) {
		added = false;
		for (const [id, node] of nodes.entries()) {
			if (node.parentId && result.has(node.parentId) && !result.has(id)) {
				result.add(id);
				added = true;
			}
		}
	}
	return result;
}

export function computeGraphView(
	nodesInput: Map<string, RecipeNode> | RecipeNode[],
	targetNodeId: string
): RecipeGraphView {
	const nodeMap =
		nodesInput instanceof Map
			? nodesInput
			: new Map(nodesInput.map((n) => [n.id, n]));

	const treeNodes = new Map<string, RecipeTreeNode>();

	for (const [id, node] of nodeMap.entries()) {
		treeNodes.set(id, {
			id,
			name: node.name,
			parentId: node.parentId,
			children: []
		});
	}

	for (const item of treeNodes.values()) {
		if (item.parentId && treeNodes.has(item.parentId)) {
			treeNodes.get(item.parentId)!.children.push(item);
		}
	}

	const currentSubtree = treeNodes.get(targetNodeId) ?? null;
	if (!currentSubtree) {
		return { subtree: null, subtreeNodes: [] };
	}

	// Walk up to the root and render the whole tree the node belongs to,
	// keeping every branch intact (no sibling collapsing).
	let cursor: RecipeTreeNode | undefined = currentSubtree;
	while (cursor?.parentId) {
		const parent = treeNodes.get(cursor.parentId);
		if (!parent) break;
		cursor = parent;
	}

	const subtree = cursor!;

	function collectSubtreeIds(node: RecipeTreeNode): string[] {
		const ids: string[] = [node.id];
		for (const child of node.children) ids.push(...collectSubtreeIds(child));
		return ids;
	}

	const allIds = collectSubtreeIds(subtree);
	const subtreeNodes = allIds
		.map((id) => nodeMap.get(id))
		.filter((n): n is RecipeNode => Boolean(n))
		.map((n) => ({
			...n,
			timestamp: new Date(n.timestamp),
			ingredientChanges: JSON.parse(JSON.stringify(n.ingredientChanges)),
			directionChanges: JSON.parse(JSON.stringify(n.directionChanges))
		}));

	return { subtree, subtreeNodes };
}

export const demoStore: RecipeStore = {
	async listTree(): Promise<RecipeTreeNode[]> {
		const nodes = get(demoNodes);
		const treeNodes = new Map<string, RecipeTreeNode>();

		for (const [id, node] of nodes.entries()) {
			treeNodes.set(id, {
				id,
				name: node.name,
				parentId: node.parentId,
				children: []
			});
		}

		const roots: RecipeTreeNode[] = [];
		for (const [id, item] of treeNodes.entries()) {
			if (item.parentId && treeNodes.has(item.parentId)) {
				treeNodes.get(item.parentId)!.children.push(item);
			} else {
				roots.push(item);
			}
		}

		return roots;
	},

	async getDashboard(limit = 5): Promise<RecipeDashboardItem[]> {
		const nodes = get(demoNodes);
		const roots = Array.from(nodes.values()).filter((n) => n.parentId === null);
		const items: RecipeDashboardItem[] = [];

		for (const root of roots) {
			const familyIds = getDescendantIds(nodes, root.id);
			const familyNodes = Array.from(familyIds).map((id) => nodes.get(id)!);

			let latestNode = root;
			let maxDate = new Date(root.timestamp);

			for (const node of familyNodes) {
				const d = new Date(node.timestamp);
				if (d.getTime() >= maxDate.getTime()) {
					maxDate = d;
					latestNode = node;
				}
			}

			const directForks = familyNodes.filter((n) => n.parentId === root.id).length;

			items.push({
				rootId: root.id,
				name: latestNode.name,
				forkCount: directForks,
				lastEditedAt: maxDate,
				leafId: latestNode.id
			});
		}

		items.sort((a, b) => b.lastEditedAt.getTime() - a.lastEditedAt.getTime());
		return items.slice(0, limit);
	},

	async getFavorites(limit = 5): Promise<RecipeFavoriteItem[]> {
		const nodes = get(demoNodes);
		const favs = Array.from(nodes.values())
			.filter((n) => Boolean(n.isFavorite))
			.map((node) => ({
				id: node.id,
				name: node.name,
				lastEditedAt: new Date(node.timestamp),
				authorName: node.author === 'Demo Chef' || node.author === 'Demo User' ? null : node.author,
				isOwner: node.author === 'Demo Chef' || node.author === 'Demo User',
				urlPath: `/mise/recipes/${node.id}`
			}))
			.sort((a, b) => b.lastEditedAt.getTime() - a.lastEditedAt.getTime());

		return typeof limit === 'number' ? favs.slice(0, limit) : favs;
	},

	async getNode(nodeId: string): Promise<RecipeNode | null> {
		const nodes = get(demoNodes);
		const node = nodes.get(nodeId);
		return node ? { ...node, timestamp: new Date(node.timestamp) } : null;
	},

	async getRecipeView(nodeId: string): Promise<RecipeDetailView | null> {
		const nodes = get(demoNodes);
		const current = nodes.get(nodeId);
		if (!current) return null;

		// Walk back chain to root
		const chainBackwards: RecipeNode[] = [];
		let cursor: RecipeNode | undefined = current;
		const visited = new Set<string>();

		while (cursor && !visited.has(cursor.id)) {
			visited.add(cursor.id);
			chainBackwards.push({ ...cursor, timestamp: new Date(cursor.timestamp) });
			if (!cursor.parentId) break;
			cursor = nodes.get(cursor.parentId);
		}

		const history = chainBackwards.reverse();
		const root = history[0];
		const state = applyNodes(history);

		const parentChain = history
			.slice(1, -1)
			.map((n) => ({ id: n.id, name: n.name }));

		return {
			recipe: {
				id: root.id,
				name: current.name,
				ingredients: state.ingredients,
				directions: state.directions
			},
			currentNode: { ...current, timestamp: new Date(current.timestamp) },
			history,
			parentChain,
			descendantSubstitutes: { flat: [], byRowId: {}, byRowKind: {} },
			inheritedImages: {
				ingredients: {},
				directions: {}
			}
		};
	},

	async getGraphView(nodeId: string): Promise<RecipeGraphView> {
		const nodes = get(demoNodes);
		return computeGraphView(nodes, nodeId);
	},

	async create(name: string): Promise<{ id: string }> {
		const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `demo-${Date.now()}`;
		const newNode: RecipeNode = {
			id,
			name: name.trim() || 'Untitled Recipe',
			parentId: null,
			timestamp: new Date(),
			author: 'Demo User',
			source: null,
			isPublic: false,
			isFavorite: false,
			imagePath: null,
			description: null,
			note: null,
			ingredientChanges: [],
			directionChanges: []
		};

		demoNodes.update((ns) => {
			const next = new Map(ns);
			next.set(id, newNode);
			return next;
		});

		demoRecipes.update((rs) => [...rs, { id, name: newNode.name, parentId: null }]);
		persist(get(demoRecipes), get(demoNodes));
		return { id };
	},

	async rename(rootNodeId: string, name: string): Promise<void> {
		const trimmed = name.trim();
		demoNodes.update((ns) => {
			const next = new Map(ns);
			const root = next.get(rootNodeId);
			if (root) {
				next.set(rootNodeId, { ...root, name: trimmed, timestamp: new Date() });
			}
			return next;
		});

		demoRecipes.update((rs) =>
			rs.map((r) => (r.id === rootNodeId ? { ...r, name: trimmed } : r))
		);

		persist(get(demoRecipes), get(demoNodes));
	},

	async fork(nodeId: string, name: string): Promise<{ id: string }> {
		const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `demo-fork-${Date.now()}`;
		const nodes = get(demoNodes);
		const parent = nodes.get(nodeId);

		const newNode: RecipeNode = {
			id,
			name: name.trim() || `${parent?.name ?? 'Recipe'} (fork)`,
			parentId: nodeId,
			timestamp: new Date(),
			author: 'Demo User',
			source: null,
			isPublic: false,
			isFavorite: false,
			imagePath: null,
			description: null,
			note: null,
			ingredientChanges: [],
			directionChanges: []
		};

		demoNodes.update((ns) => {
			const next = new Map(ns);
			next.set(id, newNode);
			return next;
		});

		demoRecipes.update((rs) => [...rs, { id, name: newNode.name, parentId: nodeId }]);
		persist(get(demoRecipes), get(demoNodes));
		return { id };
	},

	async remove(rootNodeId: string): Promise<void> {
		const nodes = get(demoNodes);
		const toRemove = getDescendantIds(nodes, rootNodeId);

		demoNodes.update((ns) => {
			const next = new Map(ns);
			for (const id of toRemove) {
				next.delete(id);
			}
			return next;
		});

		demoRecipes.update((rs) => rs.filter((r) => !toRemove.has(r.id)));
		persist(get(demoRecipes), get(demoNodes));
	},

	async saveNode(
		nodeId: string,
		ingredientChanges: IngredientChange[],
		directionChanges: DirectionChange[]
	): Promise<void> {
		demoNodes.update((ns) => {
			const next = new Map(ns);
			const existing = next.get(nodeId);
			if (existing) {
				next.set(nodeId, {
					...existing,
					ingredientChanges,
					directionChanges,
					timestamp: new Date()
				});
			}
			return next;
		});
		persist(get(demoRecipes), get(demoNodes));
	},

	async toggleFavorite(nodeId: string): Promise<boolean> {
		let nextFav = false;
		demoNodes.update((ns) => {
			const next = new Map(ns);
			const existing = next.get(nodeId);
			if (existing) {
				nextFav = !existing.isFavorite;
				next.set(nodeId, {
					...existing,
					isFavorite: nextFav
				});
			}
			return next;
		});
		persist(get(demoRecipes), get(demoNodes));
		return nextFav;
	},

	async setPublic(nodeId: string, isPublic: boolean): Promise<void> {
		demoNodes.update((ns) => {
			const next = new Map(ns);
			const existing = next.get(nodeId);
			if (existing) {
				next.set(nodeId, {
					...existing,
					isPublic
				});
			}
			return next;
		});
		persist(get(demoRecipes), get(demoNodes));
	},

	async updateNodeDetails(
		nodeId: string,
		details: { description?: string | null; note?: string | null }
	): Promise<void> {
		demoNodes.update((ns) => {
			const next = new Map(ns);
			const existing = next.get(nodeId);
			if (existing) {
				next.set(nodeId, {
					...existing,
					...(details.description !== undefined
						? { description: details.description?.trim() || null }
						: {}),
					...(details.note !== undefined ? { note: details.note?.trim() || null } : {})
				});
			}
			return next;
		});
		persist(get(demoRecipes), get(demoNodes));
	}
};
