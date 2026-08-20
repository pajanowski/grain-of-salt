import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { v4 as uuidv4 } from 'uuid';
import { recipeNodes } from '../src/lib/server/db/schema.js';
import type { IngredientChange, DirectionChange } from '../src/lib/obj/RecipeNode.svelte.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(DATABASE_URL);
const db = drizzle(client);

/**
 * Stable ingredient/direction ids so that edits in later nodes can target
 * rows added by earlier nodes within a recipe, and across recipes that
 * share ancestry.
 */
const SIMPLE_INGREDIENT_IDS = {
  eggs: uuidv4(),
  butter: uuidv4(),
  salt: uuidv4(),
};
const SIMPLE_DIRECTION_IDS = {
  beatEggs: uuidv4(),
  meltButter: uuidv4(),
  cookEggs: uuidv4(),
  foldServe: uuidv4(),
};
const CHEESE_INGREDIENT_ID = uuidv4();
const DENVER_INGREDIENT_IDS = {
  ham: uuidv4(),
  pepper: uuidv4(),
  onion: uuidv4(),
};
const FRENCH_INGREDIENT_IDS = {
  chives: uuidv4(),
};

async function seed() {
  console.log('🌱 Seeding database...');

  // Idempotent: clear before re-seeding. parentId ON DELETE CASCADE handles
  // chain descendants when we delete the root.
  await db.delete(recipeNodes);

  // -------------------------------------------------------------------------
  // Simple Omelette — top-level recipe (parentNodeId = null on its root).
  // -------------------------------------------------------------------------
  const simpleChanges = {
    ingredientChanges: [
      ingredientAdd(SIMPLE_INGREDIENT_IDS.eggs, { name: 'Eggs', amount: 3, unit: '' }),
      ingredientAdd(SIMPLE_INGREDIENT_IDS.butter, { name: 'Butter', amount: 1, unit: 'tbsp' }),
      ingredientAdd(SIMPLE_INGREDIENT_IDS.salt, { name: 'Salt', amount: 1, unit: 'pinch' }),
    ],
    directionChanges: [
      directionAdd(SIMPLE_DIRECTION_IDS.beatEggs, 'Beat eggs with salt.'),
      directionAdd(SIMPLE_DIRECTION_IDS.meltButter, 'Melt butter in a pan over medium heat.'),
      directionAdd(SIMPLE_DIRECTION_IDS.cookEggs, 'Pour in eggs, cook, stirring gently until set.'),
      directionAdd(SIMPLE_DIRECTION_IDS.foldServe, 'Fold in half and serve.'),
    ],
  };

  const simpleChain: string[] = [];
  for (const row of chainRows({
    name: 'Simple Omelette',
    parentTailId: null,
    specs: [{ label: 'initial recipe', changes: simpleChanges }],
  })) {
    await db.insert(recipeNodes).values(row);
    simpleChain.push(row.id);
  }
  const simpleTail = simpleChain[simpleChain.length - 1];

  // -------------------------------------------------------------------------
  // French Omelette — parent recipe is Simple's tail. Classic French style:
  // more butter (used for basting), low heat, constant stirring, no browning.
  // -------------------------------------------------------------------------
  const frenchChain: string[] = [];
  for (const row of chainRows({
    name: 'French Omelette',
    parentTailId: simpleTail,
    specs: [
      { label: 'start from simple omelette', changes: simpleChanges },
      {
        label: 'bump butter, add chives; cook low and slow, no browning',
        changes: {
          ingredientChanges: [
            ingredientEdit(
              SIMPLE_INGREDIENT_IDS.butter,
              { name: 'Butter', amount: 2, unit: 'tbsp' },
              'Double the butter: half for the pan, half for basting with a spoon while the eggs set.',
            ),
            ingredientAdd(
              FRENCH_INGREDIENT_IDS.chives,
              { name: 'Chives', amount: 1, unit: 'tbsp' },
              'Optional — fines herbes work too (parsley, tarragon, chervil).',
            ),
          ],
          directionChanges: [
            directionEdit(
              SIMPLE_DIRECTION_IDS.meltButter,
              'Melt butter over low heat until foamy.',
              'Low heat is non-negotiable. High heat browns the eggs before the curds form.',
            ),
            directionEdit(
              SIMPLE_DIRECTION_IDS.cookEggs,
              'Pour in eggs and stir constantly with the flat of a fork, keeping the curds moving. Do not brown.',
            ),
            directionEdit(
              SIMPLE_DIRECTION_IDS.foldServe,
              'When surface is just set and still creamy, fold in thirds and slide onto a plate.',
            ),
          ],
        },
      },
    ],
  })) {
    await db.insert(recipeNodes).values(row);
    frenchChain.push(row.id);
  }

  // -------------------------------------------------------------------------
  // Cheese Omelette — parent recipe is Simple's tail.
  // -------------------------------------------------------------------------
  const cheeseChain: string[] = [];
  for (const row of chainRows({
    name: 'Cheese Omelette',
    parentTailId: simpleTail,
    specs: [
      { label: 'start from simple omelette', changes: simpleChanges },
      {
        label: 'add cheese, fold with cheese inside',
        changes: {
          ingredientChanges: [
            ingredientAdd(CHEESE_INGREDIENT_ID, { name: 'Cheddar', amount: 50, unit: 'g' }),
          ],
          directionChanges: [
            directionEdit(
              SIMPLE_DIRECTION_IDS.foldServe,
              'When almost set, sprinkle cheese over half, fold and serve.',
            ),
          ],
        },
      },
    ],
  })) {
    await db.insert(recipeNodes).values(row);
    cheeseChain.push(row.id);
  }
  const cheeseTail = cheeseChain[cheeseChain.length - 1];

  // -------------------------------------------------------------------------
  // Denver Omelette — parent recipe is Cheese's tail.
  // -------------------------------------------------------------------------
  const denverChain: string[] = [];
  for (const row of chainRows({
    name: 'Denver Omelette',
    parentTailId: cheeseTail,
    specs: [
      { label: 'start from simple omelette', changes: simpleChanges },
      {
        label: 'add cheese, fold with cheese inside',
        changes: {
          ingredientChanges: [
            ingredientAdd(CHEESE_INGREDIENT_ID, { name: 'Cheddar', amount: 50, unit: 'g' }),
          ],
          directionChanges: [
            directionEdit(
              SIMPLE_DIRECTION_IDS.foldServe,
              'When almost set, sprinkle cheese over half, fold and serve.',
            ),
          ],
        },
      },
      {
        label: 'add diced ham, bell pepper, and onion',
        changes: {
          ingredientChanges: [
            ingredientAdd(
              DENVER_INGREDIENT_IDS.ham,
              { name: 'Ham', amount: 50, unit: 'g' },
              'Diced deli ham works fine. Skip if you want a vegetarian version.',
            ),
            ingredientAdd(DENVER_INGREDIENT_IDS.pepper, { name: 'Bell pepper', amount: 1, unit: '' }),
            ingredientAdd(DENVER_INGREDIENT_IDS.onion, { name: 'Onion', amount: 0.5, unit: '' }),
          ],
          directionChanges: [
            directionEdit(
              SIMPLE_DIRECTION_IDS.meltButter,
              'Sauté diced onion and bell pepper in butter until soft.',
            ),
            directionEdit(
              SIMPLE_DIRECTION_IDS.cookEggs,
              'Add diced ham, then pour in beaten eggs and cook gently.',
            ),
          ],
        },
      },
    ],
  })) {
    await db.insert(recipeNodes).values(row);
    denverChain.push(row.id);
  }

  console.log(
    `✅ Seeded 4 recipes (Simple / French / Cheese / Denver) with chained history and hierarchy.`,
  );
}

// --- helpers ---------------------------------------------------------------

interface NodeSpec {
  label: string;
  changes: {
    ingredientChanges: IngredientChange[];
    directionChanges: DirectionChange[];
  };
}

interface ChainArgs {
  name: string;
  parentTailId: string | null;
  specs: NodeSpec[];
}

type ChainRow = {
  id: string;
  parentId: string | null;
  parentNodeId: string | null;
  name: string;
  label: string;
  ingredientChanges: IngredientChange[];
  directionChanges: DirectionChange[];
};

/**
 * Build the chain of RecipeNode row values for one recipe. The first node
 * has parentId = null and parentNodeId = parentTailId. Subsequent nodes
 * have parentId = previous node's id and parentNodeId = null.
 */
function* chainRows(args: ChainArgs): Generator<ChainRow> {
  let prevId: string | null = null;
  let isFirst = true;
  for (const spec of args.specs) {
    const id = uuidv4();
    yield {
      id,
      parentId: prevId,
      parentNodeId: isFirst ? args.parentTailId : null,
      name: args.name,
      label: spec.label,
      ingredientChanges: spec.changes.ingredientChanges,
      directionChanges: spec.changes.directionChanges,
    };
    prevId = id;
    isFirst = false;
  }
}

function ingredientAdd(
  id: string,
  ing: { name: string; amount: number; unit: string },
  note: string | null = null,
): IngredientChange {
  return {
    id: uuidv4(),
    changeType: 'add',
    targetId: null,
    note,
    body: { id, ...ing },
  };
}

function ingredientEdit(
  targetId: string,
  ing: { name: string; amount: number; unit: string },
  note: string | null = null,
): IngredientChange {
  return {
    id: uuidv4(),
    changeType: 'edit',
    targetId,
    note,
    body: { id: targetId, ...ing },
  };
}

function directionAdd(id: string, body: string, note: string | null = null): DirectionChange {
  return {
    id: uuidv4(),
    changeType: 'add',
    targetId: null,
    note,
    body: { id, body },
  };
}

function directionEdit(targetId: string, body: string, note: string | null = null): DirectionChange {
  return {
    id: uuidv4(),
    changeType: 'edit',
    targetId,
    note,
    body: { id: targetId, body },
  };
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
