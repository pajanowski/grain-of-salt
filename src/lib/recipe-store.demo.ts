/**
 * Demo adapter for the RecipeStore (ADR 0003 — Demo adapter).
 *
 * Client-only. Backed by Svelte writables and localStorage; no module
 * singleton, no SSR coupling. The two writables — `demoRecipes` (a
 * list of summaries) and `demoNodes` (a Map keyed by node id) — are
 * the same shape every other RecipeStore returns, just materialized
 * in memory instead of in Postgres.
 *
 * Fork semantics differ from the Supabase adapter: this one
 * deep-clones the source chain with fresh IDs (per ADR 0003 — Fork
 * semantics) so a fork in demo mode is an independent recipe that
 * shares no nodes with the source. The Supabase adapter's fork is
 * chain-extension (ADR 0002), which would only matter for
 * historical-graph views the demo doesn't render anyway.
 */
import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import type { RecipeStore, RecipeSummary, RecipeTree, NodeChanges } from './recipe-store';
import type { SeedRecipeNode } from './demo-seed';
import {
	DEMO_USER,
	SEED_RECIPES,
	SEED_NODES_MAP,
	initialDemoTrees,
	seedChainFor
} from './demo-seed';

/** localStorage keys. Single namespace for the demo so Reset wipes both. */
const KEY_RECIPES = 'demo:recipes';
const KEY_NODES = 'demo:nodes';

export interface DemoNode extends SeedRecipeNode {}

/**
 * The recipes writable holds the list of summaries, root and child,
 * mirroring the shape RecipeList consumes from the real backend.
 */
export const demoRecipes: Writable<RecipeSummary[]> = writable(loadRecipes());

/**
 * The nodes writable holds every node in every demo recipe, keyed by
 * node id. Components that need to assemble a tree read from here.
 */
export const demoNodes: Writable<Map<string, DemoNode>> = writable(loadNodes());

function loadRecipes(): RecipeSummary[] {
	if (typeof localStorage === 'undefined') return SEED_RECIPES;
	const raw = localStorage.getItem(KEY_RECIPES);
	if (raw) {
		try {
			return JSON.parse(raw) as RecipeSummary[];
		} catch {
			// Corrupt storage — fall through to reseed.
		}
	}
	localStorage.setItem(KEY_RECIPES, JSON.stringify(SEED_RECIPES));
	return SEED_RECIPES;
}

function loadNodes(): Map<string, DemoNode> {
	if (typeof localStorage === 'undefined') return new Map(SEED_NODES_MAP);
	const raw = localStorage.getItem(KEY_NODES);
	if (raw) {
		try {
			const entries = JSON.parse(raw) as Array<[string, DemoNode]>;
			return new Map(entries);
		} catch {
			// fall through to seed
		}
	}
	const seedEntries: Array<[string, DemoNode]> = Array.from(SEED_NODES_MAP.entries());
	localStorage.setItem(KEY_NODES, JSON.stringify(seedEntries));
	return new Map(seedEntries);
}

function persist(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(KEY_RECIPES, JSON.stringify(get(demoRecipes)));
	localStorage.setItem(KEY_NODES, JSON.stringify(Array.from(get(demoNodes).entries())));
}

/**
 * Walk the in-memory nodes map to build a chain rooted at `recipeId`.
 * Returns an empty list when no root node is found.
 */
function chainFor(recipeId: string): DemoNode[] {
	const summary = get(demoRecipes).find((r) => r.id === recipeId);
	if (!summary) return [];
	const root = [...get(demoNodes).values()].find(
		(n) => n.id === recipeId && n.parentId === null
	);
	if (!root) return [];
	const out: DemoNode[] = [root];
	let frontier: string[] = [root.id];
	while (frontier.length > 0) {
		const next: string[] = [];
		for (const parentId of frontier) {
			for (const n of get(demoNodes).values()) {
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

/**
 * Pure helper: produce a deep-cloned chain with fresh node ids and a
 * matching summary. The summary name gets a " (fork)" suffix per
 * ADR 0003 — Fork semantics.
 */
function forkClone(sourceId: string): { summary: RecipeSummary; nodes: DemoNode[] } {
	const sourceChain = chainFor(sourceId);
	if (sourceChain.length === 0) {
		throw new Error(`Recipe not found: ${sourceId}`);
	}
	const idMap = new Map<string, string>();
	for (const n of sourceChain) idMap.set(n.id, uuidv4());
	const rootSourceId = sourceChain[0].id;
	// Invariant (mirrored everywhere in this codebase): `summary.id ===
	// rootNode.id`. The fork summary and its root node share `newRecipeId`;
	// every other source node maps to a fresh uuid via `idMap`.
	const newRecipeId = idMap.get(rootSourceId) as string;
	const summary: RecipeSummary = {
		id: newRecipeId,
		name: `${sourceChain[sourceChain.length - 1].name} (fork)`,
		parentId: null
	};
	const nodes: DemoNode[] = sourceChain.map((n) => ({
		...n,
		id: idMap.get(n.id) as string,
		recipeId: n.id === rootSourceId ? newRecipeId : (idMap.get(n.parentId as string) as string),
		parentId: n.parentId === null ? null : (idMap.get(n.parentId) as string),
		ingredientChanges: n.ingredientChanges.map((c) => ({ ...c })),
		directionChanges: n.directionChanges.map((c) => ({ ...c })),
		timestamp: new Date()
	}));
	return { summary, nodes };
}

/**
 * Reset both writables back to the seed and clear localStorage. Used
 * by the layout's "Reset demo" button and by tests.
 */
export function resetDemoState(): void {
	const trees = initialDemoTrees();
	const recipeList: RecipeSummary[] = trees.map((t) => t.summary);
	const nodeMap = new Map<string, DemoNode>();
	for (const t of trees) {
		for (const n of t.nodes) {
			nodeMap.set(n.id, n as DemoNode);
		}
	}
	demoRecipes.set(recipeList);
	demoNodes.set(nodeMap);
	persist();
}

/**
 * Construct a new summary + root node pair, update writables, persist.
 * Returns the new root recipe id (which equals the new node id).
 */
function createRoot(name: string): { id: string } {
	const id = uuidv4();
	const summary: RecipeSummary = { id, name, parentId: null };
	const node: DemoNode = {
		id,
		recipeId: id,
		name,
		parentId: null,
		label: 'root',
		timestamp: new Date(),
		ingredientChanges: [],
		directionChanges: []
	};
	demoRecipes.update((rs) => [...rs, summary]);
	demoNodes.update((ns) => {
		const next = new Map(ns);
		next.set(node.id, node);
		return next;
	});
	persist();
	return { id };
}

export const demoStore: RecipeStore = {
	async list(): Promise<RecipeSummary[]> {
		return get(demoRecipes);
	},

	async get(id: string): Promise<RecipeTree | null> {
		const summary = get(demoRecipes).find((r) => r.id === id);
		if (!summary) return null;
		const nodes = chainFor(id);
		return { summary, nodes };
	},

	async create(name: string): Promise<{ id: string }> {
		const trimmed = name.trim();
		if (!trimmed) throw new Error('Recipe name cannot be empty');
		return createRoot(trimmed);
	},

	async rename(id: string, name: string): Promise<void> {
		const trimmed = name.trim();
		if (!trimmed) return; // mirror the "fire-and-forget" no-op contract
		demoRecipes.update((rs) => rs.map((r) => (r.id === id ? { ...r, name: trimmed } : r)));
		// Also update the name on the chain's nodes so /recipes/[slug]
		// renders the new name immediately without a fresh round-trip.
		demoNodes.update((ns) => {
			const next = new Map(ns);
			for (const [nid, n] of ns) {
				if (n.recipeId === id) next.set(nid, { ...n, name: trimmed });
			}
			return next;
		});
		persist();
	},

	async fork(nodeId: string, name?: string): Promise<{ id: string }> {
		const cloned = forkClone(nodeId);
		// Thread a caller-supplied name through (production fork takes
		// the chosen name in its POST body). When omitted, the
		// "(fork)" suffix from forkClone stands.
		if (name) cloned.summary.name = name;
		demoRecipes.update((rs) => [...rs, cloned.summary]);
		demoNodes.update((ns) => {
			const next = new Map(ns);
			for (const n of cloned.nodes) next.set(n.id, n);
			return next;
		});
		persist();
		return { id: cloned.summary.id };
	},

	async remove(id: string): Promise<void> {
		demoRecipes.update((rs) => rs.filter((r) => r.id !== id));
		demoNodes.update((ns) => {
			const next = new Map(ns);
			for (const [nid, n] of ns) {
				if (n.recipeId === id) next.delete(nid);
			}
			return next;
		});
		persist();
	},

	async saveNode(nodeId: string, changes: NodeChanges): Promise<void> {
		demoNodes.update((ns) => {
			const next = new Map(ns);
			const existing = next.get(nodeId);
			if (!existing) return ns;
			next.set(nodeId, {
				...existing,
				ingredientChanges: changes.ingredientChanges,
				directionChanges: changes.directionChanges
			});
			return next;
		});
		persist();
	}
};

/** Re-export the demo user so layout / hooks can pin it without re-importing seed. */
export const DEMO_USER_EXPORT = DEMO_USER;

/** Used by tests that just want the demo recipe ids without the writables. */
export function _seedSummaries(): RecipeSummary[] {
	return SEED_RECIPES;
}

/** Used by tests that need the seed chain builder. */
export { seedChainFor };
