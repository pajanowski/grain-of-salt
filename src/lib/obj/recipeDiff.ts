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
 * Word-level diff between two strings.
 * Returns an array of tokens where:
 *   'same' — unchanged word, rendered as-is
 *   'new'  — word that only appears in `next`; render with highlight
 *
 * Used for 'edit' change segments: the new words get a darker yellow bg.
 */
export type DiffSegment = { text: string; kind: 'same' | 'new' };

export function wordDiff(prev: string, next: string): DiffSegment[] {
  const a = prev.split(/\s+/).filter(Boolean);
  const b = next.split(/\s+/).filter(Boolean);
  const out: DiffSegment[] = [];

  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ text: a[i], kind: 'same' });
      i++;
      j++;
    } else if (j < b.length) {
      // If this token appears later in `a`, treat the skipped `a` tokens
      // as replacements and mark them 'new'.
      const skipIdx = a.indexOf(b[j], i + 1);
      if (skipIdx > i) {
        while (i < skipIdx) {
          out.push({ text: a[i], kind: 'new' });
          i++;
        }
        out.push({ text: b[j], kind: 'same' });
        i++;
        j++;
      } else {
        out.push({ text: b[j], kind: 'new' });
        j++;
      }
    } else {
      // a has extra tokens — removals rendered as 'new' so the arrow
      // clearly means "was → now".
      out.push({ text: a[i], kind: 'new' });
      i++;
    }
  }

  return out;
}

export interface FormattedChange {
  kind: 'ingredient' | 'direction';
  changeType: 'add' | 'edit' | 'remove';
  text: string;
  /**
   * For 'edit' changes: word-level diff of the before/after value.
   * Render 'new' tokens with a darker yellow background to show what changed.
   * Null for 'add' / 'remove' (the full text is the added/removed thing).
   */
  segments: DiffSegment[] | null;
  /** Author-provided note, surfaced as a clickable icon in the UI. */
  note: string | null;
}

// Internal: format a single ingredient change to the full FormattedChange shape.
function formatIngredientChangeFull(
  change: IngredientChange,
  priorState: Map<string, Ingredient>,
): FormattedChange {
  const label = change.body ? ingredientLabel(change.body) : '(missing)';
  if (change.changeType === 'add') {
    return { kind: 'ingredient', changeType: 'add', text: `ADD ${label}`, segments: null, note: change.note };
  }
  if (change.changeType === 'remove') {
    const before = change.targetId ? priorState.get(change.targetId) : undefined;
    const text = before ? `REMOVE ${ingredientLabel(before)}` : `REMOVE ${label}`;
    return { kind: 'ingredient', changeType: 'remove', text, segments: null, note: change.note };
  }
  // edit
  const before = change.targetId ? priorState.get(change.targetId) : undefined;
  const beforeLabel = before ? ingredientLabel(before) : '';
  const text = before ? `EDIT ${beforeLabel} → ${label}` : `EDIT ${label}`;
  const segments = before ? wordDiff(beforeLabel, label) : null;
  return { kind: 'ingredient', changeType: 'edit', text, segments, note: change.note };
}

// Internal: format a single direction change to the full FormattedChange shape.
function formatDirectionChangeFull(
  change: DirectionChange,
  priorState: Map<string, Direction>,
): FormattedChange {
  const body = change.body ?? null;
  const label = body ? `"${directionLabel(body)}"` : '(empty)';
  if (change.changeType === 'add') {
    return { kind: 'direction', changeType: 'add', text: `ADD ${label}`, segments: null, note: change.note };
  }
  if (change.changeType === 'remove') {
    const before = change.targetId ? priorState.get(change.targetId) : undefined;
    const text = before ? `REMOVE "${directionLabel(before)}"` : `REMOVE ${label}`;
    return { kind: 'direction', changeType: 'remove', text, segments: null, note: change.note };
  }
  // edit
  const before = change.targetId ? priorState.get(change.targetId) : undefined;
  const beforeLabel = before ? directionLabel(before) : '';
  const beforeQuoted = before ? `"${beforeLabel}"` : '';
  const newLabel = body ? directionLabel(body) : '';
  const text = before ? `EDIT ${beforeQuoted} → ${label}` : `EDIT ${label}`;
  const segments = before ? wordDiff(beforeLabel, newLabel) : null;
  return { kind: 'direction', changeType: 'edit', text, segments, note: change.note };
}

/**
 * Format a single ingredient change to a human-readable string.
 * (Segments are available via `formatIngredientChangeFull`.)
 */
export function formatIngredientChange(
  change: IngredientChange,
  priorState: Map<string, Ingredient>,
): string {
  return formatIngredientChangeFull(change, priorState).text;
}

/**
 * Format a single direction change to a human-readable string.
 * (Segments are available via `formatDirectionChangeFull`.)
 */
export function formatDirectionChange(
  change: DirectionChange,
  priorState: Map<string, Direction>,
): string {
  return formatDirectionChangeFull(change, priorState).text;
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
    out.push(formatIngredientChangeFull(c, priorState.ingredients));
  }
  for (const c of node.directionChanges) {
    out.push(formatDirectionChangeFull(c, priorState.directions));
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
 * Display label for a node in the history breadcrumb.
 */
export function nodeDisplayLabel(node: RecipeNode): string {
  if (node.parentId === null) return 'Initial state';
  return node.name;
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
