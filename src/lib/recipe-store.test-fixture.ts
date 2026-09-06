/**
 * In-memory RecipeStore fixture used by the contract test suite.
 *
 * The contract tests verify that the RecipeStore interface has the
 * behaviour the rest of the app relies on. They run against this
 * minimal-but-faithful adapter so the assertions don't depend on
 * Supabase or localStorage.
 *
 * Production invariant mirrored here: `recipe.id === rootNode.id`. A
 * recipe's identity is the root node's id, so seeded root summaries
 * must back onto a root node whose id matches.
 */
import type { RecipeStore, RecipeSummary, RecipeTree } from './recipe-store';
import type { RecipeNode } from './obj/RecipeNode.svelte';
import { v4 as uuidv4 } from 'uuid';

interface InternalState {
	summaries: RecipeSummary[];
	nodes: Map<string, RecipeNode>;
}

/**
 * Build a RecipeStore backed by an in-memory map. Seeds the summaries
 * list and, for every root summary, creates one root node whose id
 * equals the summary id.
 */
export function createInMemoryStore(seedSummaries: RecipeSummary[]): RecipeStore {
	const state: InternalState = {
		summaries: [...seedSummaries],
		nodes: new Map<string, RecipeNode>()
	};
	for (const s of seedSummaries) {
		if (s.parentId === null) {
			const root: RecipeNode = {
				id: s.id,
				name: s.name,
				parentId: null,
				label: 'root',
				timestamp: new Date(),
				ingredientChanges: [],
				directionChanges: []
			};
			state.nodes.set(root.id, root);
		}
	}

	function recipesOwnedByChain(recipeRootId: string): RecipeNode[] {
		const out: RecipeNode[] = [];
		const root = [...state.nodes.values()].find(
			(n: RecipeNode): boolean => n.id === recipeRootId && n.parentId === null
		);
		if (root) out.push(root);
		let frontier: string[] = root ? [root.id] : [];
		while (frontier.length > 0) {
			const next: string[] = [];
			for (const parentId of frontier) {
				for (const n of state.nodes.values()) {
					if (n.parentId === parentId) {
						out.push(n);
						next.push(n.id);
					}
				}
			}
			frontier = next;
		}
		return out;
	}

	function buildTree(rootId: string): RecipeTree | null {
		const summary = state.summaries.find((s) => s.id === rootId);
		if (!summary) return null;
		const nodes = recipesOwnedByChain(rootId);
		return { summary, nodes };
	}

	return {
		async list(): Promise<RecipeSummary[]> {
			return [...state.summaries];
		},
		async get(id: string): Promise<RecipeTree | null> {
			return buildTree(id);
		},
		async create(name: string): Promise<{ id: string }> {
			const newSummary: RecipeSummary = { id: uuidv4(), name, parentId: null };
			state.summaries.push(newSummary);
			const root: RecipeNode = {
				id: newSummary.id,
				name,
				parentId: null,
				label: 'root',
				timestamp: new Date(),
				ingredientChanges: [],
				directionChanges: []
			};
			state.nodes.set(root.id, root);
			return { id: newSummary.id };
		},
		async rename(id: string, name: string): Promise<void> {
			const idx = state.summaries.findIndex((s) => s.id === id);
			if (idx >= 0) state.summaries[idx] = { ...state.summaries[idx], name };
		},
		async fork(nodeId: string, name?: string): Promise<{ id: string }> {
			const source = state.nodes.get(nodeId);
			if (!source) throw new Error('Not found');
			const newId = uuidv4();
			const newName = name ?? source.name;
			const newNode: RecipeNode = {
				id: newId,
				name: newName,
				parentId: source.id,
				label: null,
				timestamp: new Date(),
				ingredientChanges: [],
				directionChanges: []
			};
			state.nodes.set(newId, newNode);
			let rootId: string | null = source.id;
			while (rootId !== null) {
				const n = state.nodes.get(rootId);
				if (!n || n.parentId === null) break;
				rootId = n.parentId;
			}
			if (rootId && state.summaries.find((s) => s.id === rootId)) {
				state.summaries.push({
					id: newId,
					name: newName,
					parentId: source.id
				});
			}
			return { id: newId };
		},
		async remove(id: string): Promise<void> {
			state.summaries = state.summaries.filter((s) => s.id !== id);
			const chain = recipesOwnedByChain(id);
			for (const n of chain) state.nodes.delete(n.id);
		},
		async saveNode(
			nodeId: string,
			changes: {
				nodeId: string;
				ingredientChanges: RecipeNode['ingredientChanges'];
				directionChanges: RecipeNode['directionChanges'];
			}
		): Promise<void> {
			const existing = state.nodes.get(nodeId);
			if (!existing) throw new Error('Node not found');
			state.nodes.set(nodeId, {
				...existing,
				ingredientChanges: changes.ingredientChanges,
				directionChanges: changes.directionChanges
			});
		}
	};
}
