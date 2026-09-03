import { describe, it, expect } from 'vitest';
import type { Ingredient, Direction } from '$lib/obj/Recipe.svelte';
import type {
  RecipeNode,
  IngredientChange,
  DirectionChange,
} from '$lib/obj/RecipeNode.svelte';
import {
  applyNodes,
  updateRecipeNode,
  InvalidChangeError,
  type UpdateRecipeNodePayload,
} from './recipenodesbo';
// Re-declared so individual test cases can deliberately construct invalid
// payloads. The 'as unknown as' cast at the call site keeps TypeScript quiet
// without losing the strict validation under test.
type DraftPayload = UpdateRecipeNodePayload;

// ===========================================================================
// Unit tests for applyNodes — the pure replay function that materializes a
// recipe's state from its linked-list history.
//
// applyNodes is the heart of the system: every read path goes through it,
// and any non-deterministic or order-dependent behavior here is a bug.
//
// These tests pin down:
//  - Single-change semantics for each ChangeType (add/edit/remove)
//  - Multi-node chains (the actual production shape)
//  - Ordering rules within a node and across nodes
//  - Malformed-change handling (silent skip is the documented contract)
// ===========================================================================

function ingredient(partial: Partial<Ingredient> & { id: string }): Ingredient {
  return { name: '', amount: 0, unit: '', ...partial };
}

function direction(partial: { id: string; body: string }): Direction {
  return partial;
}

function node(
  partial: Partial<RecipeNode> & { id: string },
): RecipeNode {
  return {
    id: partial.id,
    name: partial.name ?? 'Test Recipe',
    parentId: partial.parentId ?? null,
    label: partial.label ?? null,
    timestamp: partial.timestamp ?? 0,
    ingredientChanges: partial.ingredientChanges ?? [],
    directionChanges: partial.directionChanges ?? [],
  };
}

const ingredientChange = (
  partial: Partial<IngredientChange> & { id: string },
): IngredientChange => ({
  changeType: 'add',
  targetId: null,
  note: null,
  body: null,
  ...partial,
});

const directionChange = (
  partial: Partial<DirectionChange> & { id: string },
): DirectionChange => ({
  changeType: 'add',
  targetId: null,
  note: null,
  body: null,
  ...partial,
});

describe('applyNodes', () => {
  describe('empty inputs', () => {
    it('returns empty state for an empty node list', () => {
      const state = applyNodes([]);
      expect(state.ingredients).toEqual([]);
      expect(state.directions).toEqual([]);
    });

    it('returns empty state for a node with no changes', () => {
      const state = applyNodes([node({ id: 'n1' })]);
      expect(state.ingredients).toEqual([]);
      expect(state.directions).toEqual([]);
    });
  });

  describe('add', () => {
    it('materializes a single add change', () => {
      const flour = ingredient({ id: 'i1', name: 'Flour', amount: 200, unit: 'g' });
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c1',
              changeType: 'add',
              body: flour,
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients).toEqual([flour]);
    });

    it('materializes multiple adds in one node', () => {
      const flour = ingredient({ id: 'i1', name: 'Flour', amount: 200, unit: 'g' });
      const milk = ingredient({ id: 'i2', name: 'Milk', amount: 300, unit: 'ml' });
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({ id: 'c1', changeType: 'add', body: flour }),
            ingredientChange({ id: 'c2', changeType: 'add', body: milk }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients).toHaveLength(2);
      expect(state.ingredients).toContainEqual(flour);
      expect(state.ingredients).toContainEqual(milk);
    });

    it('uses body.id as the canonical key when present', () => {
      const flour = ingredient({ id: 'real-id', name: 'Flour' });
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'change-id',
              changeType: 'add',
              body: flour,
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients[0].id).toBe('real-id');
    });

    it('falls back to change.id when body.id is missing', () => {
      // body.id is empty string (falsy); change.id should be used.
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'fallback-id',
              changeType: 'add',
              body: ingredient({ id: '', name: 'Flour' }),
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients[0].id).toBe('fallback-id');
    });
  });

  describe('edit', () => {
    it('replaces the existing ingredient by targetId', () => {
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c1',
              changeType: 'add',
              body: ingredient({ id: 'i1', name: 'Flour', amount: 200 }),
            }),
          ],
        }),
        node({
          id: 'n2',
          parentId: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c2',
              changeType: 'edit',
              targetId: 'i1',
              body: ingredient({ id: 'i1', name: 'Flour', amount: 250 }),
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients).toHaveLength(1);
      expect(state.ingredients[0].amount).toBe(250);
    });

    it('forces targetId onto the body so the key stays stable', () => {
      // body.id differs from targetId — the edit should keep the targetId
      // so the entry remains findable by its original key.
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c1',
              changeType: 'add',
              body: ingredient({ id: 'i1', name: 'Flour' }),
            }),
          ],
        }),
        node({
          id: 'n2',
          parentId: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c2',
              changeType: 'edit',
              targetId: 'i1',
              body: ingredient({ id: 'WRONG', name: 'Flour', amount: 999 }),
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients).toHaveLength(1);
      expect(state.ingredients[0].id).toBe('i1');
      expect(state.ingredients[0].amount).toBe(999);
    });

    it('is a no-op when targetId does not exist', () => {
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c1',
              changeType: 'edit',
              targetId: 'ghost',
              body: ingredient({ id: 'ghost', name: 'Flour' }),
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients).toEqual([]);
    });
  });

  describe('remove', () => {
    it('removes the ingredient by targetId', () => {
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c1',
              changeType: 'add',
              body: ingredient({ id: 'i1', name: 'Flour' }),
            }),
            ingredientChange({
              id: 'c2',
              changeType: 'add',
              body: ingredient({ id: 'i2', name: 'Milk' }),
            }),
          ],
        }),
        node({
          id: 'n2',
          parentId: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c3',
              changeType: 'remove',
              targetId: 'i1',
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients).toHaveLength(1);
      expect(state.ingredients[0].id).toBe('i2');
    });

    it('is a no-op when targetId does not exist', () => {
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c1',
              changeType: 'remove',
              targetId: 'ghost',
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients).toEqual([]);
    });
  });

  describe('directions', () => {
    it('handles add/edit/remove symmetrically with ingredients', () => {
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          directionChanges: [
            directionChange({
              id: 'c1',
              changeType: 'add',
              body: direction({ id: 'd1', body: 'Mix' }),
            }),
            directionChange({
              id: 'c2',
              changeType: 'add',
              body: direction({ id: 'd2', body: 'Bake' }),
            }),
          ],
        }),
        node({
          id: 'n2',
          parentId: 'n1',
          directionChanges: [
            directionChange({
              id: 'c3',
              changeType: 'edit',
              targetId: 'd1',
              body: direction({ id: 'd1', body: 'Whisk' }),
            }),
            directionChange({
              id: 'c4',
              changeType: 'remove',
              targetId: 'd2',
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.directions).toHaveLength(1);
      expect(state.directions[0].body).toBe('Whisk');
    });
  });

  describe('multi-node chains', () => {
    it('applies nodes in array order (caller is responsible for ordering)', () => {
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c1',
              changeType: 'add',
              body: ingredient({ id: 'i1', name: 'Flour', amount: 200 }),
            }),
          ],
        }),
        node({
          id: 'n2',
          parentId: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c2',
              changeType: 'edit',
              targetId: 'i1',
              body: ingredient({ id: 'i1', name: 'Flour', amount: 250 }),
            }),
          ],
        }),
        node({
          id: 'n3',
          parentId: 'n2',
          ingredientChanges: [
            ingredientChange({
              id: 'c3',
              changeType: 'add',
              body: ingredient({ id: 'i2', name: 'Sugar', amount: 50 }),
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients).toHaveLength(2);
      expect(state.ingredients.find((i) => i.id === 'i1')?.amount).toBe(250);
      expect(state.ingredients.find((i) => i.id === 'i2')?.amount).toBe(50);
    });

    it('produces the same state regardless of how changes are grouped into nodes', () => {
      // Three adds, all in one node vs three nodes, each with one add.
      const flour = ingredient({ id: 'i1', name: 'Flour' });
      const milk = ingredient({ id: 'i2', name: 'Milk' });
      const sugar = ingredient({ id: 'i3', name: 'Sugar' });

      const singleNode: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({ id: 'c1', changeType: 'add', body: flour }),
            ingredientChange({ id: 'c2', changeType: 'add', body: milk }),
            ingredientChange({ id: 'c3', changeType: 'add', body: sugar }),
          ],
        }),
      ];

      const manyNodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({ id: 'c1', changeType: 'add', body: flour }),
          ],
        }),
        node({
          id: 'n2',
          parentId: 'n1',
          ingredientChanges: [
            ingredientChange({ id: 'c2', changeType: 'add', body: milk }),
          ],
        }),
        node({
          id: 'n3',
          parentId: 'n2',
          ingredientChanges: [
            ingredientChange({ id: 'c3', changeType: 'add', body: sugar }),
          ],
        }),
      ];

      const a = applyNodes(singleNode).ingredients.map((i) => i.id).sort();
      const b = applyNodes(manyNodes).ingredients.map((i) => i.id).sort();
      expect(a).toEqual(b);
    });
  });

  describe('ordering within a single node', () => {
    it('respects array order — a remove after an edit of the same id wins', () => {
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            // First: add i1
            ingredientChange({
              id: 'c1',
              changeType: 'add',
              body: ingredient({ id: 'i1', name: 'Flour' }),
            }),
          ],
        }),
        node({
          id: 'n2',
          parentId: 'n1',
          ingredientChanges: [
            // Edit then remove: remove wins, i1 gone.
            ingredientChange({
              id: 'c2',
              changeType: 'edit',
              targetId: 'i1',
              body: ingredient({ id: 'i1', name: 'Flour', amount: 999 }),
            }),
            ingredientChange({
              id: 'c3',
              changeType: 'remove',
              targetId: 'i1',
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients).toEqual([]);
    });

    it('respects array order — remove before edit silently drops the edit', () => {
      // Edit on a missing target is a no-op (documented), so this is fine.
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c1',
              changeType: 'remove',
              targetId: 'i1',
            }),
            ingredientChange({
              id: 'c2',
              changeType: 'edit',
              targetId: 'i1',
              body: ingredient({ id: 'i1', name: 'Flour', amount: 999 }),
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients).toEqual([]);
    });
  });

  describe('malformed changes (silent skip)', () => {
    it('skips an add with no body', () => {
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({ id: 'c1', changeType: 'add', body: null }),
          ],
        }),
      ];

      expect(() => applyNodes(nodes)).not.toThrow();
      expect(applyNodes(nodes).ingredients).toEqual([]);
    });

    it('skips an edit with no targetId', () => {
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c1',
              changeType: 'edit',
              targetId: null,
              body: ingredient({ id: 'i1', name: 'Flour' }),
            }),
          ],
        }),
      ];

      expect(() => applyNodes(nodes)).not.toThrow();
      expect(applyNodes(nodes).ingredients).toEqual([]);
    });

    it('skips an edit with no body', () => {
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c1',
              changeType: 'edit',
              targetId: 'i1',
              body: null,
            }),
          ],
        }),
      ];

      expect(() => applyNodes(nodes)).not.toThrow();
      expect(applyNodes(nodes).ingredients).toEqual([]);
    });

    it('does not throw on a remove with no targetId', () => {
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({ id: 'c1', changeType: 'remove', targetId: null }),
          ],
        }),
      ];

      expect(() => applyNodes(nodes)).not.toThrow();
      expect(applyNodes(nodes).ingredients).toEqual([]);
    });
  });

  describe('mixed ingredient + direction changes in the same node', () => {
    it('handles them independently', () => {
      const nodes: RecipeNode[] = [
        node({
          id: 'n1',
          ingredientChanges: [
            ingredientChange({
              id: 'c1',
              changeType: 'add',
              body: ingredient({ id: 'i1', name: 'Flour' }),
            }),
          ],
          directionChanges: [
            directionChange({
              id: 'c2',
              changeType: 'add',
              body: direction({ id: 'd1', body: 'Mix' }),
            }),
          ],
        }),
      ];

      const state = applyNodes(nodes);
      expect(state.ingredients).toHaveLength(1);
      expect(state.directions).toHaveLength(1);
    });
  });
});

// ===========================================================================
// Integration-style tests for the seed scenario:
//
//   Simple Omelette   (root with adds)
//        |
//   Cheese Omelette   (root replays simple; child adds cheese, edits fold)
//        |
//   Denver Omelette   (root replays simple; middle adds cheese;
//                      final adds ham/pepper/onion and edits two steps)
//
// These tests assert the materialized state for each recipe, so a future
// refactor that breaks the seed->materialize pipeline will fail here.
// ===========================================================================

function seedIngredientAdd(
  id: string,
  ing: { name: string; amount: number; unit: string },
): IngredientChange {
  return {
    id: `chg-${id}`,
    changeType: 'add',
    targetId: null,
    note: null,
    body: { id, ...ing },
  };
}

function seedIngredientEdit(
  targetId: string,
  ing: { name: string; amount: number; unit: string },
): IngredientChange {
  return {
    id: `chg-edit-${targetId}-${Math.random()}`,
    changeType: 'edit',
    targetId,
    note: null,
    body: { id: targetId, ...ing },
  };
}

function seedDirectionAdd(id: string, body: string): DirectionChange {
  return {
    id: `chg-${id}`,
    changeType: 'add',
    targetId: null,
    note: null,
    body: { id, body },
  };
}

function seedDirectionEdit(targetId: string, body: string): DirectionChange {
  return {
    id: `chg-edit-${targetId}-${Math.random()}`,
    changeType: 'edit',
    targetId,
    note: null,
    body: { id: targetId, body },
  };
}

// Stable ids used across recipes, mirroring what the seed script does.
const SIMPLE_INGREDIENT_IDS = {
  eggs: 'sim-eggs',
  butter: 'sim-butter',
  salt: 'sim-salt',
};
const SIMPLE_DIRECTION_IDS = {
  beatEggs: 'sim-d-beat',
  meltButter: 'sim-d-melt',
  cookEggs: 'sim-d-cook',
  foldServe: 'sim-d-fold',
};
const CHEESE_INGREDIENT_ID = 'cheese-cheddar';
const FRENCH_INGREDIENT_IDS = {
  chives: 'fr-chives',
};
const DENVER_INGREDIENT_IDS = {
  ham: 'den-ham',
  pepper: 'den-pepper',
  onion: 'den-onion',
};

function simpleOmeletteRootChanges() {
  return {
    ingredientChanges: [
      seedIngredientAdd(SIMPLE_INGREDIENT_IDS.eggs, { name: 'Eggs', amount: 3, unit: '' }),
      seedIngredientAdd(SIMPLE_INGREDIENT_IDS.butter, { name: 'Butter', amount: 1, unit: 'tbsp' }),
      seedIngredientAdd(SIMPLE_INGREDIENT_IDS.salt, { name: 'Salt', amount: 1, unit: 'pinch' }),
    ],
    directionChanges: [
      seedDirectionAdd(SIMPLE_DIRECTION_IDS.beatEggs, 'Beat eggs with salt.'),
      seedDirectionAdd(SIMPLE_DIRECTION_IDS.meltButter, 'Melt butter in a pan over medium heat.'),
      seedDirectionAdd(SIMPLE_DIRECTION_IDS.cookEggs, 'Pour in eggs, cook, stirring gently until set.'),
      seedDirectionAdd(SIMPLE_DIRECTION_IDS.foldServe, 'Fold in half and serve.'),
    ],
  };
}

function seedNode(
  id: string,
  parentId: string | null,
  label: string,
  changes: {
    ingredientChanges: IngredientChange[];
    directionChanges: DirectionChange[];
  },
  name = 'Test Recipe',
): RecipeNode {
  return {
    id,
    name,
    parentId,
    label,
    timestamp: 0,
    ingredientChanges: changes.ingredientChanges,
    directionChanges: changes.directionChanges,
  };
}

function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

describe('omelette history scenarios (seed parity)', () => {
  describe('Simple Omelette', () => {
    it('materializes to eggs, butter, salt and four directions', () => {
      const nodes: RecipeNode[] = [
        seedNode('n1', null, 'initial recipe', simpleOmeletteRootChanges()),
      ];
      const state = applyNodes(nodes);

      expect(state.ingredients.map((i) => i.name).sort()).toEqual(['Butter', 'Eggs', 'Salt']);
      expect(state.directions.map((d) => d.body)).toEqual([
        'Beat eggs with salt.',
        'Melt butter in a pan over medium heat.',
        'Pour in eggs, cook, stirring gently until set.',
        'Fold in half and serve.',
      ]);
    });
  });

  describe('French Omelette', () => {
    const frenchNodes: RecipeNode[] = [
      seedNode('fr1', null, 'start from simple omelette', simpleOmeletteRootChanges()),
      seedNode('fr2', 'fr1', 'bump butter, add chives; cook low and slow, no browning', {
        ingredientChanges: [
          seedIngredientEdit(SIMPLE_INGREDIENT_IDS.butter, { name: 'Butter', amount: 2, unit: 'tbsp' }),
          seedIngredientAdd(FRENCH_INGREDIENT_IDS.chives, { name: 'Chives', amount: 1, unit: 'tbsp' }),
        ],
        directionChanges: [
          seedDirectionEdit(
            SIMPLE_DIRECTION_IDS.meltButter,
            'Melt butter over low heat until foamy.',
          ),
          seedDirectionEdit(
            SIMPLE_DIRECTION_IDS.cookEggs,
            'Pour in eggs and stir constantly with the flat of a fork, keeping the curds moving. Do not brown.',
          ),
          seedDirectionEdit(
            SIMPLE_DIRECTION_IDS.foldServe,
            'When surface is just set and still creamy, fold in thirds and slide onto a plate.',
          ),
        ],
      }),
    ];

    it('ends with 4 ingredients (eggs, butter, salt, chives) — no duplicate butter', () => {
      const state = applyNodes(frenchNodes);
      const ingredients = byId(state.ingredients);
      expect(ingredients.size).toBe(4);
      expect(state.ingredients.map((i) => i.name).sort()).toEqual(['Butter', 'Chives', 'Eggs', 'Salt']);
    });

    it('edits the butter amount from 1 tbsp to 2 tbsp instead of adding a second row', () => {
      const state = applyNodes(frenchNodes);
      const ingredients = byId(state.ingredients);
      expect(ingredients.get(SIMPLE_INGREDIENT_IDS.butter)?.amount).toBe(2);
      expect(ingredients.get(SIMPLE_INGREDIENT_IDS.butter)?.unit).toBe('tbsp');
    });

    it('rewrites all three cooking steps but keeps their ids', () => {
      const state = applyNodes(frenchNodes);
      const directions = byId(state.directions);
      expect(directions.size).toBe(4);
      expect(directions.get(SIMPLE_DIRECTION_IDS.meltButter)?.body).toBe('Melt butter over low heat until foamy.');
      expect(directions.get(SIMPLE_DIRECTION_IDS.cookEggs)?.body).toBe(
        'Pour in eggs and stir constantly with the flat of a fork, keeping the curds moving. Do not brown.',
      );
      expect(directions.get(SIMPLE_DIRECTION_IDS.foldServe)?.body).toBe(
        'When surface is just set and still creamy, fold in thirds and slide onto a plate.',
      );
    });

    it('leaves the beat-eggs direction untouched', () => {
      const state = applyNodes(frenchNodes);
      const directions = byId(state.directions);
      expect(directions.get(SIMPLE_DIRECTION_IDS.beatEggs)?.body).toBe('Beat eggs with salt.');
    });
  });

  describe('Cheese Omelette', () => {
    it('adds cheddar and rewrites the fold step', () => {
      const nodes: RecipeNode[] = [
        seedNode('n1', null, 'start from simple omelette', simpleOmeletteRootChanges()),
        seedNode('n2', 'n1', 'add cheese, fold with cheese inside', {
          ingredientChanges: [
            seedIngredientAdd(CHEESE_INGREDIENT_ID, { name: 'Cheddar', amount: 50, unit: 'g' }),
          ],
          directionChanges: [
            seedDirectionEdit(
              SIMPLE_DIRECTION_IDS.foldServe,
              'When almost set, sprinkle cheese over half, fold and serve.',
            ),
          ],
        }),
      ];
      const state = applyNodes(nodes);

      const ingredientsById = byId(state.ingredients);
      expect(ingredientsById.size).toBe(4);
      expect(ingredientsById.get(SIMPLE_INGREDIENT_IDS.eggs)?.name).toBe('Eggs');
      expect(ingredientsById.get(SIMPLE_INGREDIENT_IDS.butter)?.name).toBe('Butter');
      expect(ingredientsById.get(SIMPLE_INGREDIENT_IDS.salt)?.name).toBe('Salt');
      expect(ingredientsById.get(CHEESE_INGREDIENT_ID)?.name).toBe('Cheddar');

      const directionsById = byId(state.directions);
      expect(directionsById.size).toBe(4);
      expect(directionsById.get(SIMPLE_DIRECTION_IDS.beatEggs)?.body).toBe('Beat eggs with salt.');
      expect(directionsById.get(SIMPLE_DIRECTION_IDS.meltButter)?.body).toBe('Melt butter in a pan over medium heat.');
      expect(directionsById.get(SIMPLE_DIRECTION_IDS.cookEggs)?.body).toBe('Pour in eggs, cook, stirring gently until set.');
      expect(directionsById.get(SIMPLE_DIRECTION_IDS.foldServe)?.body).toBe(
        'When almost set, sprinkle cheese over half, fold and serve.',
      );
    });

    it('preserves direction ids across the edit (no duplicate directions)', () => {
      const nodes: RecipeNode[] = [
        seedNode('n1', null, 'start from simple omelette', simpleOmeletteRootChanges()),
        seedNode('n2', 'n1', 'add cheese, fold with cheese inside', {
          ingredientChanges: [seedIngredientAdd(CHEESE_INGREDIENT_ID, { name: 'Cheddar', amount: 50, unit: 'g' })],
          directionChanges: [
            seedDirectionEdit(SIMPLE_DIRECTION_IDS.foldServe, 'When almost set, sprinkle cheese over half, fold and serve.'),
          ],
        }),
      ];
      const state = applyNodes(nodes);
      expect(state.directions).toHaveLength(4);
    });
  });

  describe('Denver Omelette', () => {
    const denverNodes: RecipeNode[] = [
      seedNode('dn1', null, 'start from simple omelette', simpleOmeletteRootChanges()),
      seedNode('dn2', 'dn1', 'add cheese, fold with cheese inside', {
        ingredientChanges: [seedIngredientAdd(CHEESE_INGREDIENT_ID, { name: 'Cheddar', amount: 50, unit: 'g' })],
        directionChanges: [
          seedDirectionEdit(SIMPLE_DIRECTION_IDS.foldServe, 'When almost set, sprinkle cheese over half, fold and serve.'),
        ],
      }),
      seedNode('dn3', 'dn2', 'add diced ham, bell pepper, and onion', {
        ingredientChanges: [
          seedIngredientAdd(DENVER_INGREDIENT_IDS.ham, { name: 'Ham', amount: 50, unit: 'g' }),
          seedIngredientAdd(DENVER_INGREDIENT_IDS.pepper, { name: 'Bell pepper', amount: 1, unit: '' }),
          seedIngredientAdd(DENVER_INGREDIENT_IDS.onion, { name: 'Onion', amount: 0.5, unit: '' }),
        ],
        directionChanges: [
          seedDirectionEdit(
            SIMPLE_DIRECTION_IDS.meltButter,
            'Sauté diced onion and bell pepper in butter until soft.',
          ),
          seedDirectionEdit(
            SIMPLE_DIRECTION_IDS.cookEggs,
            'Add diced ham, then pour in beaten eggs and cook gently.',
          ),
        ],
      }),
    ];

    it('ends with 7 ingredients (3 simple + cheese + 3 denver)', () => {
      const state = applyNodes(denverNodes);
      expect(state.ingredients).toHaveLength(7);
    });

    it('preserves all original simple ingredients untouched', () => {
      const state = applyNodes(denverNodes);
      const byIds = byId(state.ingredients);
      expect(byIds.get(SIMPLE_INGREDIENT_IDS.eggs)).toBeDefined();
      expect(byIds.get(SIMPLE_INGREDIENT_IDS.butter)).toBeDefined();
      expect(byIds.get(SIMPLE_INGREDIENT_IDS.salt)).toBeDefined();
    });

    it('includes cheddar from the middle node', () => {
      const state = applyNodes(denverNodes);
      expect(byId(state.ingredients).get(CHEESE_INGREDIENT_ID)?.name).toBe('Cheddar');
    });

    it('includes all three denver additions (ham, pepper, onion)', () => {
      const state = applyNodes(denverNodes);
      const names = state.ingredients.map((i) => i.name).sort();
      expect(names).toContain('Ham');
      expect(names).toContain('Bell pepper');
      expect(names).toContain('Onion');
    });

    it('rewrites the melt-butter and cook-eggs directions but keeps their ids', () => {
      const state = applyNodes(denverNodes);
      const directions = byId(state.directions);
      expect(directions.size).toBe(4);
      expect(directions.get(SIMPLE_DIRECTION_IDS.meltButter)?.body).toBe(
        'Sauté diced onion and bell pepper in butter until soft.',
      );
      expect(directions.get(SIMPLE_DIRECTION_IDS.cookEggs)?.body).toBe(
        'Add diced ham, then pour in beaten eggs and cook gently.',
      );
    });

    it('leaves the beat-eggs and fold-serve directions untouched', () => {
      const state = applyNodes(denverNodes);
      const directions = byId(state.directions);
      expect(directions.get(SIMPLE_DIRECTION_IDS.beatEggs)?.body).toBe('Beat eggs with salt.');
      expect(directions.get(SIMPLE_DIRECTION_IDS.foldServe)?.body).toBe(
        'When almost set, sprinkle cheese over half, fold and serve.',
      );
    });

    it('preserves direction counts: 4 directions throughout, no duplicates', () => {
      const state = applyNodes(denverNodes);
      expect(state.directions).toHaveLength(4);
      const ids = new Set(state.directions.map((d) => d.id));
      expect(ids.size).toBe(4);
    });
  });
});

// ===========================================================================
// Validation tests for updateRecipeNode. The validator runs synchronously
// before any DB call, so each invalid payload rejects with InvalidChangeError
// without needing a database. Ownership / write-path coverage lives in e2e.
// ===========================================================================
describe('updateRecipeNode payload validation', () => {
  const validIngredient = (): Ingredient => ({
    id: 'ing-1',
    name: 'Egg',
    amount: 2,
    unit: ''
  });

  const validDirection = (): Direction => ({ id: 'dir-1', body: 'Beat eggs' });

  const basePayload = (): DraftPayload => ({
    nodeId: 'node-1',
    ingredientChanges: [] as IngredientChange[],
    directionChanges: [] as DirectionChange[]
  });



  function expectInvalid(payload: unknown): void {
    // Validators throw synchronously; the async wrapper surfaces the rejection.
    void expect(updateRecipeNode(payload as never, 'owner-1')).rejects.toBeInstanceOf(
      InvalidChangeError
    );
  }

  it('accepts a minimal valid payload (no changes, no label)', async () => {
    // Will fail downstream at the DB call (no real node), but should pass
    // validation. We can't easily assert "passed validation" without a DB
    // mock — so just confirm the error is NOT InvalidChangeError.
    await expect(
      updateRecipeNode(basePayload(), 'owner-1')
    ).rejects.not.toBeInstanceOf(InvalidChangeError);
  });

  it('rejects when payload is null', () => {
    expectInvalid(null);
  });

  it('rejects when nodeId is missing', () => {
    const p = basePayload();
    expectInvalid({ ...p, nodeId: '' });
  });

  it('rejects when ingredientChanges is not an array', () => {
    const p = basePayload();
    expectInvalid({ ...p, ingredientChanges: 'not-an-array' });
  });

  it('rejects when directionChanges is not an array', () => {
    const p = basePayload();
    expectInvalid({ ...p, directionChanges: 'not-an-array' });
  });

  describe('ingredient change validation', () => {
    it('rejects add with non-null targetId', () => {
      const p = basePayload();
      p.ingredientChanges = [
        {
          id: 'c-1',
          changeType: 'add',
          targetId: 'someone-elses-add',
          note: null,
          body: validIngredient()
        }
      ];
      expectInvalid(p);
    });

    it('rejects add with missing body', () => {
      const p = basePayload();
      p.ingredientChanges = [
        { id: 'c-1', changeType: 'add', targetId: null, note: null, body: null }
      ];
      expectInvalid(p);
    });

    it('rejects edit with missing targetId', () => {
      const p = basePayload();
      p.ingredientChanges = [
        { id: 'c-1', changeType: 'edit', targetId: '', note: null, body: validIngredient() }
      ];
      expectInvalid(p);
    });

    it('rejects edit with missing body', () => {
      const p = basePayload();
      p.ingredientChanges = [
        { id: 'c-1', changeType: 'edit', targetId: 'some-add', note: null, body: null }
      ];
      expectInvalid(p);
    });

    it('rejects remove with missing targetId', () => {
      const p = basePayload();
      p.ingredientChanges = [
        { id: 'c-1', changeType: 'remove', targetId: '', note: null, body: null }
      ];
      expectInvalid(p);
    });

    it('rejects remove with non-null body', () => {
      const p = basePayload();
      p.ingredientChanges = [
        { id: 'c-1', changeType: 'remove', targetId: 'some-add', note: null, body: validIngredient() }
      ];
      expectInvalid(p);
    });

    it('rejects unknown changeType', () => {
      const p = basePayload();
      // Cast through unknown so the bogus changeType compiles even though
      // it isn't a legal ChangeType — the validation we're testing rejects
      // it at runtime.
      p.ingredientChanges = [
        { id: 'c-1', changeType: 'bogus', targetId: null, note: null, body: null }
      ] as unknown as IngredientChange[];
      expectInvalid(p);
    });


    it('accepts a valid add', async () => {
      const p = basePayload();
      p.ingredientChanges = [
        { id: 'c-1', changeType: 'add', targetId: null, note: null, body: validIngredient() }
      ];
      // Passes validation; fails downstream at the DB call.
      await expect(updateRecipeNode(p, 'owner-1')).rejects.not.toBeInstanceOf(
        InvalidChangeError
      );
    });
  });

  describe('direction change validation', () => {
    it('rejects add with non-null targetId', () => {
      const p = basePayload();
      p.directionChanges = [
        {
          id: 'c-1',
          changeType: 'add',
          targetId: 'someone-elses-add',
          note: null,
          body: validDirection()
        }
      ];
      expectInvalid(p);
    });

    it('rejects edit with missing body', () => {
      const p = basePayload();
      p.directionChanges = [
        { id: 'c-1', changeType: 'edit', targetId: 'some-add', note: null, body: null }
      ];
      expectInvalid(p);
    });

    it('rejects remove with non-null body', () => {
      const p = basePayload();
      p.directionChanges = [
        { id: 'c-1', changeType: 'remove', targetId: 'some-add', note: null, body: validDirection() }
      ];
      expectInvalid(p);
    });
  });
});

