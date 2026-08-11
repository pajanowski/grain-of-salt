import type { Ingredient, Direction } from "./Recipe.svelte";
import type {
  RecipeNode,
  IngredientChange,
  DirectionChange,
} from "./RecipeNode.svelte";

/**
 * Pure helpers for turning a RecipeNode / Change into human-readable
 * descriptions, suitable for a "history" UI.
 *
 * To produce before/after diffs for 'edit' changes, the formatter needs the
 * state BEFORE the change was applied. The caller folds over the chain,
 * replaying each node's changes and passing the pre-state into the
 * formatter. See `formatChain` below.
 */

function ingredientLabel(ing: Ingredient): string {
  const amount = ing.amount ? `${ing.amount}` : '';
  const unit = ing.unit ?? '';
  let qty = '';
  if (amount && unit) qty = `${amount} ${unit}`;
  else if (amount) qty = amount;
  else if (unit) qty = unit;
  return qty ? `${qty} ${ing.name}` : ing.name || '(unnamed ingredient)';
}

function directionLabel(dir: Direction): string {
  return dir.body || '(empty direction)';
}

/**
 * Format a single change with access to the state that existed BEFORE this
 * change was applied. With that, 'edit' can show "old → new" and 'remove'
 * can show what was removed.
 */
export function formatIngredientChange(
  change: IngredientChange,
  priorState: Map<string, Ingredient>,
): string {
  switch (change.changeType) {
    case 'add':
      return change.body ? `added ingredient: ${ingredientLabel(change.body)}` : 'added ingredient (missing body)';
    case 'edit': {
      if (!change.body) return 'edited ingredient (missing body)';
      const before = change.targetId ? priorState.get(change.targetId) : undefined;
      const after = ingredientLabel(change.body);
      return before
        ? `edited ingredient: ${ingredientLabel(before)} → ${after}`
        : `edited ingredient → ${after}`;
    }
    case 'remove': {
      const before = change.targetId ? priorState.get(change.targetId) : undefined;
      return before
        ? `removed ingredient: ${ingredientLabel(before)}${change.note ? ` — ${change.note}` : ''}`
        : `removed ingredient${change.note ? ` — ${change.note}` : ''}`;
    }
  }
}

export function formatDirectionChange(
  change: DirectionChange,
  priorState: Map<string, Direction>,
): string {
  switch (change.changeType) {
    case 'add':
      return change.body ? `added direction: "${directionLabel(change.body)}"` : 'added direction (missing body)';
    case 'edit': {
      if (!change.body) return 'edited direction (missing body)';
      const before = change.targetId ? priorState.get(change.targetId) : undefined;
      const after = directionLabel(change.body);
      return before
        ? `edited direction: "${directionLabel(before)}" → "${after}"`
        : `edited direction → "${after}"`;
    }
    case 'remove': {
      const before = change.targetId ? priorState.get(change.targetId) : undefined;
      return before
        ? `removed direction: "${directionLabel(before)}"${change.note ? ` — ${change.note}` : ''}`
        : `removed direction${change.note ? ` — ${change.note}` : ''}`;
    }
  }
}

export interface FormattedChange {
  kind: 'ingredient' | 'direction';
  changeType: 'add' | 'edit' | 'remove';
  text: string;
  /** Author-provided note, surfaced as a clickable icon in the UI. */
  note: string | null;
}

/**
 * Format the changes within a single node, given the state BEFORE this
 * node's changes were applied. The caller is responsible for providing
 * that pre-state — see `formatChain` for the typical way to compute it.
 */
export function formatNode(
  node: RecipeNode,
  priorState: RecipeStateMaps,
): FormattedChange[] {
  const out: FormattedChange[] = [];
  for (const c of node.ingredientChanges) {
    out.push({
      kind: 'ingredient',
      changeType: c.changeType,
      text: formatIngredientChange(c, priorState.ingredients),
      note: c.note,
    });
  }
  for (const c of node.directionChanges) {
    out.push({
      kind: 'direction',
      changeType: c.changeType,
      text: formatDirectionChange(c, priorState.directions),
      note: c.note,
    });
  }
  return out;
}

/**
 * Maps keyed by ingredient/direction id, suitable for fast lookups during
 * diff formatting.
 */
export interface RecipeStateMaps {
  ingredients: Map<string, Ingredient>;
  directions: Map<string, Direction>;
}

export interface FormattedChainEntry {
  node: RecipeNode;
  changes: FormattedChange[];
  /** State after this node's changes have been applied. */
  stateAfter: RecipeStateMaps;
}

/**
 * Format an entire ordered chain of nodes. Returns one entry per node with
 * its changes (already diffed against the state before that node) and the
 * state after applying that node. The first entry's `stateAfter` is the
 * fully materialized recipe; subsequent entries show incremental changes.
 *
 * This is a pure function — callers can run it during render or memoize it.
 */
export function formatChain(nodes: RecipeNode[]): FormattedChainEntry[] {
  const ingredients = new Map<string, Ingredient>();
  const directions = new Map<string, Direction>();
  const out: FormattedChainEntry[] = [];

  for (const node of nodes) {
    // Snapshot state BEFORE this node's changes for the formatter.
    const priorState: RecipeStateMaps = {
      ingredients: new Map(ingredients),
      directions: new Map(directions),
    };

    const changes = formatNode(node, priorState);

    // Now actually apply the changes to advance the state.
    for (const c of node.ingredientChanges) applyIngredientChange(ingredients, c);
    for (const c of node.directionChanges) applyDirectionChange(directions, c);

    out.push({
      node,
      changes,
      stateAfter: { ingredients: new Map(ingredients), directions: new Map(directions) },
    });
  }

  return out;
}

function applyIngredientChange(state: Map<string, Ingredient>, change: IngredientChange): void {
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

function applyDirectionChange(state: Map<string, Direction>, change: DirectionChange): void {
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

/**
 * Fallback label for a node when its `label` field is null.
 */
export function nodeDisplayLabel(node: RecipeNode, index: number): string {
  if (node.label) return node.label;
  if (node.parentId === null) return 'Initial state';
  const total = node.ingredientChanges.length + node.directionChanges.length;
  if (total === 0) return `Edit #${index}`;
  if (total === 1) return `Edit: 1 change`;
  return `Edit: ${total} changes`;
}

/**
 * Format a Unix-ms timestamp as a localized date+time string. Returns an
 * empty string if the timestamp is missing/invalid.
 */
export function formatTimestamp(ms: number): string {
  if (!ms || Number.isNaN(ms)) return '';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '';
  }
}
