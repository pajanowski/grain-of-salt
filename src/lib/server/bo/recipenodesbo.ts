import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '../db/index';
import { recipeNodes } from '../db/schema';
import type { InsertRecipeNode, SelectRecipeNode } from '../db/schema';
import type { Ingredient, Direction, Recipe } from '$lib/obj/Recipe.svelte';
import type { RecipeNode, IngredientChange, DirectionChange } from '$lib/obj/RecipeNode.svelte';

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
 * The root node has parentId = null and an empty change list — it represents
 * the recipe's initial state (which callers may then append child nodes to).
 */
export async function createRootRecipeNode(recipeId: string, name: string, parentNodeId: string | null = null): Promise<RecipeNode> {
  const id = uuid();
  const row: InsertRecipeNode = {
    id,
    recipeId,
    parentId: null,
    parentNodeId,
    name,
    label: null,
    ingredientChanges: [],
    directionChanges: [],
  };
  await db.insert(recipeNodes).values(row);
  return {
    id,
    recipeId,
    name,
    parentId: null,
    parentNodeId,
    label: null,
    timestamp: Date.now(),
    ingredientChanges: [],
    directionChanges: [],
  };
}

/**
 * Append a child node to an existing parent. parentId is required — to create
 * the first node of a recipe, use createRootRecipeNode.
 */
export async function appendRecipeNode(
  recipeId: string,
  parentId: string,
  name: string,
  ingredientChanges: IngredientChange[],
  directionChanges: DirectionChange[],
  label: string | null = null,
): Promise<RecipeNode> {
  const id = uuid();
  const row: InsertRecipeNode = {
    id,
    recipeId,
    parentId,
    parentNodeId: null,
    name,
    label,
    ingredientChanges,
    directionChanges,
  };
  await db.insert(recipeNodes).values(row);
  return {
    id,
    recipeId,
    name,
    parentId,
    parentNodeId: null,
    label,
    timestamp: Date.now(),
    ingredientChanges,
    directionChanges,
  };
}

/**
 * Fetch every node for a recipe, oldest first.
 * One round trip; suitable for recipes with bounded history depth.
 */
export async function getRecipeNodesByRecipeId(recipeId: string): Promise<RecipeNode[]> {
  const rows: SelectRecipeNode[] = await db
    .select()
    .from(recipeNodes)
    .where(eq(recipeNodes.recipeId, recipeId))
    .orderBy(asc(recipeNodes.timestamp));
  return rows.map(toUiRecipeNode);
}

/**
 * Alias of getRecipeNodesByRecipeId for readability at call sites that
 * are building a history UI.
 */
export const getRecipeHistory = getRecipeNodesByRecipeId;

/**
 * Fetch the head (root) node for a recipe. Returns null if none exists.
 */
export async function getRootRecipeNode(recipeId: string): Promise<RecipeNode | null> {
  const rows = await db
    .select()
    .from(recipeNodes)
    .where(and(eq(recipeNodes.recipeId, recipeId), isNull(recipeNodes.parentId)))
    .limit(1);
  const row = rows[0];
  return row ? toUiRecipeNode(row) : null;
}

/**
 * Materialize a recipe's current state by replaying every node in order.
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
export async function getRecipeState(recipeId: string): Promise<RecipeState> {
  const nodes = await getRecipeNodesByRecipeId(recipeId);
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
    recipeId: row.recipeId,
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
    const created = await createRootRecipeNode(recipe.id, recipe.name);
    parentId = created.id;
  } else {
    parentId = tail.id;
  }

  await appendRecipeNode(
    recipe.id,
    parentId,
    recipe.name,
    ingredientChanges,
    directionChanges,
    label,
  );

  return applyNodes(await getRecipeNodesByRecipeId(recipe.id));
}

/**
 * Fetch the most recently created node for a recipe (the tail of the list).
 * Returns null if the recipe has no nodes.
 */
async function getLatestRecipeNode(recipeId: string): Promise<RecipeNode | null> {
  const rows = await db
    .select()
    .from(recipeNodes)
    .where(eq(recipeNodes.recipeId, recipeId))
    .orderBy(desc(recipeNodes.timestamp))
    .limit(1);
  const row = rows[0];
  return row ? toUiRecipeNode(row) : null;
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
 * A recipe as it appears in the list/tree UI. A "recipe" is identified by
 * its root node id; the rest of the recipe's chain is hidden behind the
 * applyNodes replay.
 */
export interface RecipeSummary {
  /** Root node id. Doubles as the recipe's identity. */
  id: string;
  /** FK into the recipes table (kept for the future migration to drop it). */
  recipeId: string;
  name: string;
  /** Tail node id (the most recent node in this recipe's chain). */
  tailId: string | null;
  /** Hierarchy pointer. Null for top-level recipes. */
  parentNodeId: string | null;
}

export interface RecipeTreeNode extends RecipeSummary {
  children: RecipeTreeNode[];
}

/**
 * Build the recipe hierarchy for the list UI. Each recipe's tail node id is
 * included so child recipes (which point at parentNodeId) can be linked.
 *
 * One query: SELECT root nodes (parentId IS NULL) plus a per-recipe latest
 * node lookup. For larger datasets, switch to a single query that fetches
 * all nodes and walks in memory.
 */
export async function getRecipeTree(): Promise<RecipeTreeNode[]> {
  const rows: SelectRecipeNode[] = await db
    .select()
    .from(recipeNodes)
    .where(isNull(recipeNodes.parentId))
    .orderBy(asc(recipeNodes.timestamp));

  const roots = rows.map(toUiRecipeNode);

  // For each root, find its tail (the last node in the chain by timestamp).
  const summaries: RecipeSummary[] = await Promise.all(
    roots.map(async (root) => {
      const tail = await getLatestRecipeNode(root.recipeId);
      return {
        id: root.id,
        recipeId: root.recipeId,
        name: root.name,
        tailId: tail?.id ?? null,
        parentNodeId: root.parentNodeId,
      };
    }),
  );

  // Index by tailId so we can wire up children by parentNodeId.
  const byParentTailId = new Map<string, RecipeSummary>();
  for (const s of summaries) {
    if (s.tailId) byParentTailId.set(s.tailId, s);
  }

  // Group children under their parent.
  const childrenByParent = new Map<string, RecipeSummary[]>();
  const topLevel: RecipeSummary[] = [];
  for (const s of summaries) {
    if (s.parentNodeId && byParentTailId.has(s.parentNodeId)) {
      const parent = byParentTailId.get(s.parentNodeId)!;
      const parentId = parent.tailId!;
      const list = childrenByParent.get(parentId) ?? [];
      list.push(s);
      childrenByParent.set(parentId, list);
    } else {
      topLevel.push(s);
    }
  }

  // Recursive build — depth is bounded by the hierarchy, not the chain.
  function build(s: RecipeSummary): RecipeTreeNode {
    return {
      ...s,
      children: (childrenByParent.get(s.tailId ?? '') ?? []).map(build),
    };
  }

  return topLevel.map(build);
}

// getLatestRecipeNode is defined earlier in the file and reused here.
