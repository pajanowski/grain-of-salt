import { v4 as uuid } from 'uuid';
import { asc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index';
import { recipeNodes } from '../db/schema';
import type { InsertRecipeNode, SelectRecipeNode } from '../db/schema';
import type { Ingredient, Direction, Recipe } from '$lib/obj/Recipe.svelte';
import type { RecipeNode, IngredientChange, DirectionChange } from '$lib/obj/RecipeNode.svelte';
import { getRecipeNodeById } from '../db/queries';

/**
 * Materialized state derived by replaying every node in a recipe's history,
 * oldest first.
 */
export interface RecipeState {
  ingredients: Ingredient[];
  directions: Direction[];
}

/**
 * Create a root node for a brand-new recipe.
 * The root node has parentId = null.
 *
 * `parentId`, when set, points to a node in the parent recipe — establishing
 * this recipe as a "child" of that one (e.g. a fork or a derived recipe).
 */
export async function createRootRecipeNode(
  name: string,
  parentId: string | null = null,
): Promise<RecipeNode> {
  const row: InsertRecipeNode = {
    parentId,
    parentNodeId: null,
    name,
    label: null,
    ingredientChanges: [],
    directionChanges: [],
  };
  const [inserted] = await db.insert(recipeNodes).values(row).returning();
  return toUiRecipeNode(inserted);
}

/**
 * Append a child node to an existing parent. parentId is required — to create
 * the first node of a recipe, use createRootRecipeNode.
 */
export async function appendRecipeNode(
  parentId: string,
  name: string,
  ingredientChanges: IngredientChange[],
  directionChanges: DirectionChange[],
  label: string | null = null,
): Promise<RecipeNode> {
  const row: InsertRecipeNode = {
    parentId,
    parentNodeId: null,
    name,
    label,
    ingredientChanges,
    directionChanges,
  };
  const [inserted] = await db.insert(recipeNodes).values(row).returning();
  return toUiRecipeNode(inserted);
}

/**
 * Fetch every node in the chain rooted by rootNodeId, oldest first.
 *
 * The chain is a linked list via `parentId`: each non-root node's parentId
 * points to its predecessor. We walk forward from the root until we hit a
 * leaf — bounded by history depth, so the per-chain query count is
 * proportional to chain length.
 */
export async function getRecipeNodesByRecipeId(rootNodeId: string): Promise<RecipeNode[]> {
  const nodes: RecipeNode[] = [];
  let cursor: string | null = rootNodeId;
  const visited = new Set<string>();
  while (cursor !== null) {
    if (visited.has(cursor)) break; // cycle guard
    visited.add(cursor);
    const rows = await db
      .select()
      .from(recipeNodes)
      .where(eq(recipeNodes.id, cursor))
      .limit(1);
    const row = rows[0];
    if (!row) break;
    nodes.push(toUiRecipeNode(row));
    const next = await db
      .select({ id: recipeNodes.id })
      .from(recipeNodes)
      .where(eq(recipeNodes.parentId, cursor))
      .orderBy(asc(recipeNodes.timestamp))
      .limit(1);
    cursor = next[0]?.id ?? null;
  }
  return nodes;
}

export async function getRecipeNodesByRecipeIdV2(recipeNodeId: string): Promise<RecipeNode[]> {
  const nodes: RecipeNode[] = [];
  let curId: string | null = recipeNodeId;
  while (curId != null) {
    const recipeNode = await getRecipeNodeById(curId);
    curId = recipeNode?.parentId ?? null;
    if (recipeNode) {
      nodes.push(recipeNode)
    }
  }

  return nodes;
}

/**
 * Alias of getRecipeNodesByRecipeId for readability at call sites that
 * are building a history UI.
 */
export const getRecipeHistory = getRecipeNodesByRecipeId;

/**
 * Resolve any node id in a chain to the chain's root (the node whose
 * parentId is null). Returns null if no node with that id exists.
 */
export async function getRootRecipeNode(nodeId: string): Promise<RecipeNode | null> {
  let cursorId: string | null = nodeId;
  const visited = new Set<string>();
  let cursor: SelectRecipeNode | null = null;
  while (cursorId !== null) {
    if (visited.has(cursorId)) break;
    visited.add(cursorId);
    const rows: SelectRecipeNode[] = await db
      .select()
      .from(recipeNodes)
      .where(eq(recipeNodes.id, cursorId))
      .limit(1);
    const row: SelectRecipeNode | undefined = rows[0];
    if (!row) return null;
    cursor = row;
    cursorId = row.parentId;
  }
  return cursor ? toUiRecipeNode(cursor) : null;
}
/**
 *
 * Ordering rules:
 *  - Nodes are applied in ascending timestamp order (oldest first).
 *  - Within a node, ingredientChanges are applied in array order, then
 *    directionChanges in array order. Callers are responsible for ordering
 *    their changes such that a 'remove' of an id precedes any later
 *    'edit'/'add' that would conflict with it.
 *
 * 'add' inserts a new row, 'edit' replaces the row by targetId, 'remove'
 * deletes the row by targetId.
 */
export async function getRecipeState(rootNodeId: string): Promise<RecipeState> {
  const nodes = await getRecipeNodesByRecipeId(rootNodeId);
  return applyNodes(nodes);
}

/**
 * Pure function: replay an ordered list of nodes against an empty state.
 * Exported for testing and for callers who already have the nodes in hand.
 */
export function applyNodes(nodes: RecipeNode[]): RecipeState {
  const ingredients = new Map<string, Ingredient>();
  const directions = new Map<string, Direction>();

  for (const node of nodes) {
    for (const change of node.ingredientChanges) {
      applyIngredientChange(ingredients, change);
    }
    for (const change of node.directionChanges) {
      applyDirectionChange(directions, change);
    }
  }

  return {
    ingredients: Array.from(ingredients.values()),
    directions: Array.from(directions.values()),
  };
}

function applyIngredientChange(
  state: Map<string, Ingredient>,
  change: IngredientChange,
): void {
  switch (change.changeType) {
    case 'add': {
      if (!change.body) return; // malformed: add requires a body
      const id = change.body.id || change.id;
      state.set(id, { ...change.body, id });
      return;
    }
    case 'edit': {
      if (!change.targetId || !change.body) return; // malformed
      if (state.has(change.targetId)) {
        state.set(change.targetId, { ...change.body, id: change.targetId });
      }
      return;
    }
    case 'remove': {
      if (change.targetId) state.delete(change.targetId);
      return;
    }
  }
}

function applyDirectionChange(
  state: Map<string, Direction>,
  change: DirectionChange,
): void {
  switch (change.changeType) {
    case 'add': {
      if (!change.body) return;
      const id = change.body.id || change.id;
      state.set(id, { ...change.body, id });
      return;
    }
    case 'edit': {
      if (!change.targetId || !change.body) return;
      if (state.has(change.targetId)) {
        state.set(change.targetId, { ...change.body, id: change.targetId });
      }
      return;
    }
    case 'remove': {
      if (change.targetId) state.delete(change.targetId);
      return;
    }
  }
}

function toUiRecipeNode(row: SelectRecipeNode): RecipeNode {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    parentNodeId: row.parentNodeId,
    label: row.label,
    timestamp: row.timestamp instanceof Date ? row.timestamp.getTime() : Number(row.timestamp),
    ingredientChanges: (row.ingredientChanges ?? []) as IngredientChange[],
    directionChanges: (row.directionChanges ?? []) as DirectionChange[],
  };
}

/**
 * Diff a target Recipe against the current materialized state and append a
 * single node that transforms one into the other. The new node chains off
 * the current tail (or the root, if no tail yet) — the linked list grows
 * at the head of *time*, not branching off the root.
 *
 * - Ingredients/directions in the target but not in current -> 'add'
 * - Ingredients/directions in both, but with different fields -> 'edit'
 * - Ingredients/directions in current but not in target -> 'remove'
 *
 * If there is no root node yet (legacy recipe), one is created with the
 * current empty state and then a second node carries the diff.
 *
 * Returns the materialized state after the new node is applied.
 */
export async function updateRecipeState(recipe: Recipe, label: string | null = null): Promise<RecipeState> {
  const current = await getRecipeState(recipe.id);

  const ingredientChanges = diffIngredients(current.ingredients, recipe.ingredients);
  const directionChanges = diffDirections(current.directions, recipe.directions);

  if (ingredientChanges.length === 0 && directionChanges.length === 0) {
    // No-op save; current state already matches.
    return current;
  }

  // Chain off the current tail (latest node) so the linked list stays linear.
  // If no nodes exist, create a root and chain off it.
  let parentId: string;
  const tail = await getLatestRecipeNode(recipe.id);
  if (!tail) {
    const created = await createRootRecipeNode(recipe.name);
    parentId = created.id;
  } else {
    parentId = tail.id;
  }

  await appendRecipeNode(
    parentId,
    recipe.name,
    ingredientChanges,
    directionChanges,
    label,
  );

  return applyNodes(await getRecipeNodesByRecipeId(recipe.id));
}

/**
 * Fetch the most recently created node in the chain rooted by rootNodeId
 * (the tail of the list). Returns null if the recipe has no nodes.
 */
async function getLatestRecipeNode(rootNodeId: string): Promise<RecipeNode | null> {
  const chain = await getRecipeNodesByRecipeId(rootNodeId);
  if (chain.length === 0) return null;
  return chain[chain.length - 1];
}

function diffIngredients(
  current: Ingredient[],
  next: Ingredient[],
): IngredientChange[] {
  const currentById = new Map(current.map((i) => [i.id, i]));
  const nextById = new Map(next.map((i) => [i.id, i]));

  const changes: IngredientChange[] = [];

  // adds and edits
  for (const [id, ing] of nextById) {
    const prior = currentById.get(id);
    if (!prior) {
      changes.push({
        id: uuid(),
        changeType: 'add',
        targetId: null,
        note: null,
        body: ing,
      });
    } else if (!ingredientEqual(prior, ing)) {
      changes.push({
        id: uuid(),
        changeType: 'edit',
        targetId: id,
        note: null,
        body: ing,
      });
    }
  }

  // removes
  for (const id of currentById.keys()) {
    if (!nextById.has(id)) {
      changes.push({
        id: uuid(),
        changeType: 'remove',
        targetId: id,
        note: null,
        body: null,
      });
    }
  }

  return changes;
}

function diffDirections(
  current: Direction[],
  next: Direction[],
): DirectionChange[] {
  const currentById = new Map(current.map((d) => [d.id, d]));
  const nextById = new Map(next.map((d) => [d.id, d]));

  const changes: DirectionChange[] = [];

  for (const [id, dir] of nextById) {
    const prior = currentById.get(id);
    if (!prior) {
      changes.push({
        id: uuid(),
        changeType: 'add',
        targetId: null,
        note: null,
        body: dir,
      });
    } else if (prior.body !== dir.body) {
      changes.push({
        id: uuid(),
        changeType: 'edit',
        targetId: id,
        note: null,
        body: dir,
      });
    }
  }

  for (const id of currentById.keys()) {
    if (!nextById.has(id)) {
      changes.push({
        id: uuid(),
        changeType: 'remove',
        targetId: id,
        note: null,
        body: null,
      });
    }
  }

  return changes;
}

function ingredientEqual(a: Ingredient, b: Ingredient): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.amount === b.amount &&
    a.unit === b.unit
  );
}

/**
 * A recipe as it appears in the list/tree UI. Each RecipeNode is its own
 * recipe; parentId points to the parent recipe's node.
 */
export interface RecipeSummary {
  id: string;
  name: string;
  /** Null for top-level (root) recipes. */
  parentId: string | null;
}

export interface RecipeTreeNode extends RecipeSummary {
  children: RecipeTreeNode[];
}

/**
 * Build the recipe hierarchy for the list UI.
 *
 * Every node is a recipe. The tree is rooted at nodes with parentId = null.
 * Each node's direct parent is identified by its parentId; we only add a
 * node to the tree if its parent already exists as a node (otherwise it
 * bubbles up to top-level).
 *
 * One query: fetch every node, then process in memory. For larger
 * datasets, switch to per-recipe recursive CTEs.
 */
export async function getRecipeTree(): Promise<RecipeTreeNode[]> {
  const allRows: SelectRecipeNode[] = await db.select().from(recipeNodes);

  // Index every node by id for O(1) lookups and for building the tree in-place.
  const nodeMap = new Map<string, RecipeTreeNode>();
  for (const row of allRows) {
    nodeMap.set(row.id, { id: row.id, name: row.name, parentId: row.parentId, children: [] });
  }

  const topLevel: RecipeTreeNode[] = [];

  // Add each node as a child of its direct parent. If the parent is not in
  // nodeMap (shouldn't happen), treat it as top-level.
  for (const node of nodeMap.values()) {
    if (node.parentId === null) {
      topLevel.push(node);
    } else {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphaned node — treat as top-level.
        topLevel.push(node);
      }
    }
  }

  return topLevel;
}
