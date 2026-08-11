import { describe, it, expect } from 'vitest';
import type { Ingredient, Direction } from './Recipe.svelte';
import type {
  RecipeNode,
  IngredientChange,
  DirectionChange,
} from './RecipeNode.svelte';
import {
  formatIngredientChange,
  formatDirectionChange,
  formatChain,
  formatNode,
} from './recipeDiff';

// --- helpers ---------------------------------------------------------------

function ingredient(partial: Partial<Ingredient> & { id: string }): Ingredient {
  return { name: '', amount: 0, unit: '', ...partial };
}

function direction(partial: { id: string; body: string }): Direction {
  return partial;
}

function ingredientAdd(id: string, ing: { name: string; amount: number; unit: string }): IngredientChange {
  return { id: `add-${id}`, changeType: 'add', targetId: null, note: null, body: { id, ...ing } };
}

function ingredientEdit(targetId: string, ing: { name: string; amount: number; unit: string }): IngredientChange {
  return { id: `edit-${targetId}`, changeType: 'edit', targetId, note: null, body: { id: targetId, ...ing } };
}

function ingredientRemove(targetId: string, note: string | null = null): IngredientChange {
  return { id: `rm-${targetId}`, changeType: 'remove', targetId, note, body: null };
}

function directionAdd(id: string, body: string): DirectionChange {
  return { id: `add-${id}`, changeType: 'add', targetId: null, note: null, body: { id, body } };
}

function directionEdit(targetId: string, body: string): DirectionChange {
  return { id: `edit-${targetId}`, changeType: 'edit', targetId, note: null, body: { id: targetId, body } };
}

function directionRemove(targetId: string, note: string | null = null): DirectionChange {
  return { id: `rm-${targetId}`, changeType: 'remove', targetId, note, body: null };
}

function node(
  partial: Partial<RecipeNode> & { id: string; recipeId: string },
): RecipeNode {
  return {
    id: partial.id,
    recipeId: partial.recipeId,
    name: partial.name ?? 'Test',
    parentId: partial.parentId ?? null,
    parentNodeId: partial.parentNodeId ?? null,
    label: partial.label ?? null,
    timestamp: partial.timestamp ?? 0,
    ingredientChanges: partial.ingredientChanges ?? [],
    directionChanges: partial.directionChanges ?? [],
  };
}

const emptyMaps = () => ({
  ingredients: new Map<string, Ingredient>(),
  directions: new Map<string, Direction>(),
});

// ===========================================================================
// formatIngredientChange / formatDirectionChange
// ===========================================================================

describe('formatIngredientChange', () => {
  it('formats an add with quantity and unit', () => {
    const change = ingredientAdd('i1', { name: 'Flour', amount: 200, unit: 'g' });
    expect(formatIngredientChange(change, new Map())).toBe('added ingredient: 200 g Flour');
  });

  it('formats an add without quantity or unit', () => {
    const change = ingredientAdd('i1', { name: 'Eggs', amount: 0, unit: '' });
    expect(formatIngredientChange(change, new Map())).toBe('added ingredient: Eggs');
  });

  it('formats an edit with before → after when target exists in prior state', () => {
    const change = ingredientEdit('i1', { name: 'Butter', amount: 2, unit: 'tbsp' });
    const prior = new Map<string, Ingredient>([
      ['i1', ingredient({ id: 'i1', name: 'Butter', amount: 1, unit: 'tbsp' })],
    ]);
    expect(formatIngredientChange(change, prior)).toBe(
      'edited ingredient: 1 tbsp Butter → 2 tbsp Butter',
    );
  });

  it('formats an edit with only the new value when target is missing from prior state', () => {
    const change = ingredientEdit('ghost', { name: 'Butter', amount: 2, unit: 'tbsp' });
    expect(formatIngredientChange(change, new Map())).toBe('edited ingredient → 2 tbsp Butter');
  });

  it('formats a remove showing what was removed', () => {
    const change = ingredientRemove('i1');
    const prior = new Map<string, Ingredient>([
      ['i1', ingredient({ id: 'i1', name: 'Flour', amount: 200, unit: 'g' })],
    ]);
    expect(formatIngredientChange(change, prior)).toBe('removed ingredient: 200 g Flour');
  });

  it('formats a remove with a note', () => {
    const change = ingredientRemove('i1', 'substituted with honey');
    const prior = new Map<string, Ingredient>([
      ['i1', ingredient({ id: 'i1', name: 'Sugar', amount: 2, unit: 'tbsp' })],
    ]);
    expect(formatIngredientChange(change, prior)).toBe(
      'removed ingredient: 2 tbsp Sugar — substituted with honey',
    );
  });
});

describe('formatDirectionChange', () => {
  it('formats an add with quoted body', () => {
    const change = directionAdd('d1', 'Mix flour and water.');
    expect(formatDirectionChange(change, new Map())).toBe(
      'added direction: "Mix flour and water."',
    );
  });

  it('formats an edit with before → after when target exists', () => {
    const change = directionEdit('d1', 'Whisk flour and water.');
    const prior = new Map<string, Direction>([['d1', direction({ id: 'd1', body: 'Mix flour and water.' })]]);
    expect(formatDirectionChange(change, prior)).toBe(
      'edited direction: "Mix flour and water." → "Whisk flour and water."',
    );
  });

  it('formats an edit with only the new value when target is missing', () => {
    const change = directionEdit('ghost', 'Whisk flour and water.');
    expect(formatDirectionChange(change, new Map())).toBe(
      'edited direction → "Whisk flour and water."',
    );
  });

  it('formats a remove showing what was removed', () => {
    const change = directionRemove('d1');
    const prior = new Map<string, Direction>([['d1', direction({ id: 'd1', body: 'Mix flour and water.' })]]);
    expect(formatDirectionChange(change, prior)).toBe(
      'removed direction: "Mix flour and water."',
    );
  });
});

// ===========================================================================
// formatChain — the end-to-end pipeline that the UI uses.
// ===========================================================================

describe('formatChain', () => {
  it('produces one entry per node with stateAfter reflecting each node', () => {
    const nodes: RecipeNode[] = [
      node({
        id: 'n1',
        recipeId: 'r1',
        ingredientChanges: [ingredientAdd('i1', { name: 'Flour', amount: 200, unit: 'g' })],
      }),
    ];
    const [entry] = formatChain(nodes);
    expect(entry.changes).toHaveLength(1);
    expect(entry.stateAfter.ingredients.size).toBe(1);
  });

  it('uses the state BEFORE each node when formatting its changes', () => {
    // Node 1: add Butter (1 tbsp)
    // Node 2: edit Butter to 2 tbsp — should show "1 tbsp Butter → 2 tbsp Butter"
    const nodes: RecipeNode[] = [
      node({
        id: 'n1',
        recipeId: 'r1',
        ingredientChanges: [ingredientAdd('i1', { name: 'Butter', amount: 1, unit: 'tbsp' })],
      }),
      node({
        id: 'n2',
        recipeId: 'r1',
        parentId: 'n1',
        ingredientChanges: [ingredientEdit('i1', { name: 'Butter', amount: 2, unit: 'tbsp' })],
      }),
    ];
    const entries = formatChain(nodes);
    expect(entries[1].changes[0].text).toBe('edited ingredient: 1 tbsp Butter → 2 tbsp Butter');
  });

  it('a remove formats against the state before its node, even after multiple prior nodes', () => {
    const nodes: RecipeNode[] = [
      node({
        id: 'n1',
        recipeId: 'r1',
        ingredientChanges: [ingredientAdd('i1', { name: 'Flour', amount: 200, unit: 'g' })],
      }),
      node({
        id: 'n2',
        recipeId: 'r1',
        parentId: 'n1',
        ingredientChanges: [ingredientEdit('i1', { name: 'Flour', amount: 250, unit: 'g' })],
      }),
      node({
        id: 'n3',
        recipeId: 'r1',
        parentId: 'n2',
        ingredientChanges: [ingredientRemove('i1')],
      }),
    ];
    const entries = formatChain(nodes);
    // The remove should reference the post-edit value (250 g Flour), not the original.
    expect(entries[2].changes[0].text).toBe('removed ingredient: 250 g Flour');
  });

  it('each entry stateAfter matches the accumulated state up to that node', () => {
    const nodes: RecipeNode[] = [
      node({
        id: 'n1',
        recipeId: 'r1',
        ingredientChanges: [ingredientAdd('i1', { name: 'Butter', amount: 1, unit: 'tbsp' })],
      }),
      node({
        id: 'n2',
        recipeId: 'r1',
        parentId: 'n1',
        ingredientChanges: [ingredientEdit('i1', { name: 'Butter', amount: 2, unit: 'tbsp' })],
      }),
    ];
    const entries = formatChain(nodes);
    expect(entries[0].stateAfter.ingredients.get('i1')?.amount).toBe(1);
    expect(entries[1].stateAfter.ingredients.get('i1')?.amount).toBe(2);
  });

  it('handles ingredient and direction changes in the same node', () => {
    const nodes: RecipeNode[] = [
      node({
        id: 'n1',
        recipeId: 'r1',
        ingredientChanges: [ingredientAdd('i1', { name: 'Flour', amount: 200, unit: 'g' })],
        directionChanges: [directionAdd('d1', 'Mix flour.')],
      }),
      node({
        id: 'n2',
        recipeId: 'r1',
        parentId: 'n1',
        ingredientChanges: [ingredientEdit('i1', { name: 'Flour', amount: 250, unit: 'g' })],
        directionChanges: [directionEdit('d1', 'Whisk flour.')],
      }),
    ];
    const entries = formatChain(nodes);
    expect(entries[1].changes).toHaveLength(2);
    expect(entries[1].changes[0]).toMatchObject({ kind: 'ingredient', text: 'edited ingredient: 200 g Flour → 250 g Flour' });
    expect(entries[1].changes[1]).toMatchObject({ kind: 'direction', text: 'edited direction: "Mix flour." → "Whisk flour."' });
  });

  it('threads through the change note so the UI can show a note icon', () => {
    const noteChange: IngredientChange = {
      id: 'edit-i1',
      changeType: 'edit',
      targetId: 'i1',
      note: 'substituted because the shop was out of salted butter',
      body: { id: 'i1', name: 'Butter', amount: 2, unit: 'tbsp' },
    };
    const nodes: RecipeNode[] = [
      node({
        id: 'n1',
        recipeId: 'r1',
        ingredientChanges: [ingredientAdd('i1', { name: 'Butter', amount: 1, unit: 'tbsp' })],
      }),
      node({
        id: 'n2',
        recipeId: 'r1',
        parentId: 'n1',
        ingredientChanges: [noteChange],
      }),
    ];
    const entries = formatChain(nodes);
    expect(entries[1].changes[0].note).toBe('substituted because the shop was out of salted butter');
    expect(entries[0].changes[0].note).toBeNull();
  });

  it('formats the French-omelette chain end-to-end', () => {
    // This mirrors scripts/seed.ts: Simple -> French.
    const nodes: RecipeNode[] = [
      node({
        id: 'fr1',
        recipeId: 'r-fr',
        ingredientChanges: [
          ingredientAdd('sim-eggs', { name: 'Eggs', amount: 3, unit: '' }),
          ingredientAdd('sim-butter', { name: 'Butter', amount: 1, unit: 'tbsp' }),
          ingredientAdd('sim-salt', { name: 'Salt', amount: 1, unit: 'pinch' }),
        ],
        directionChanges: [
          directionAdd('sim-d-beat', 'Beat eggs with salt.'),
          directionAdd('sim-d-melt', 'Melt butter in a pan over medium heat.'),
          directionAdd('sim-d-cook', 'Pour in eggs, cook, stirring gently until set.'),
          directionAdd('sim-d-fold', 'Fold in half and serve.'),
        ],
      }),
      node({
        id: 'fr2',
        recipeId: 'r-fr',
        parentId: 'fr1',
        ingredientChanges: [
          ingredientEdit('sim-butter', { name: 'Butter', amount: 2, unit: 'tbsp' }),
          ingredientAdd('fr-chives', { name: 'Chives', amount: 1, unit: 'tbsp' }),
        ],
        directionChanges: [
          directionEdit('sim-d-melt', 'Melt butter over low heat until foamy.'),
          directionEdit('sim-d-cook', 'Pour in eggs and stir constantly with the flat of a fork, keeping the curds moving. Do not brown.'),
          directionEdit('sim-d-fold', 'When surface is just set and still creamy, fold in thirds and slide onto a plate.'),
        ],
      }),
    ];
    const entries = formatChain(nodes);

    // First node: all adds
    const first = entries[0].changes.map((c) => c.text);
    expect(first).toContain('added ingredient: 1 tbsp Butter');
    expect(first).toContain('added ingredient: 3 Eggs');
    expect(first).toContain('added direction: "Beat eggs with salt."');

    // Second node: butter edit shows before -> after; chives add; directions edit.
    const second = entries[1].changes.map((c) => c.text);
    expect(second).toContain('edited ingredient: 1 tbsp Butter → 2 tbsp Butter');
    expect(second).toContain('added ingredient: 1 tbsp Chives');
    expect(second).toContain('edited direction: "Melt butter in a pan over medium heat." → "Melt butter over low heat until foamy."');
    expect(second).toContain('edited direction: "Pour in eggs, cook, stirring gently until set." → "Pour in eggs and stir constantly with the flat of a fork, keeping the curds moving. Do not brown."');
  });
});

// ===========================================================================
// formatNode — single-node formatter. Should accept the prior state
// explicitly so callers can compute it however they want.
// ===========================================================================

describe('formatNode', () => {
  it('uses the supplied prior state for edit diffs', () => {
    const nd: RecipeNode = node({
      id: 'n1',
      recipeId: 'r1',
      ingredientChanges: [ingredientEdit('i1', { name: 'Butter', amount: 2, unit: 'tbsp' })],
    });
    const prior = emptyMaps();
    prior.ingredients.set('i1', ingredient({ id: 'i1', name: 'Butter', amount: 1, unit: 'tbsp' }));
    const changes = formatNode(nd, prior);
    expect(changes[0].text).toBe('edited ingredient: 1 tbsp Butter → 2 tbsp Butter');
  });

  it('does not mutate the supplied prior state maps', () => {
    const nd: RecipeNode = node({
      id: 'n1',
      recipeId: 'r1',
      ingredientChanges: [
        ingredientAdd('i1', { name: 'Flour', amount: 200, unit: 'g' }),
        ingredientEdit('i1', { name: 'Flour', amount: 250, unit: 'g' }),
      ],
    });
    const prior = emptyMaps();
    formatNode(nd, prior);
    // The prior map should still be empty — formatNode doesn't apply changes.
    expect(prior.ingredients.size).toBe(0);
  });
});
