import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { v4 as uuidv4 } from 'uuid';
import { sql } from 'drizzle-orm';
import { recipeNodes } from '../src/lib/server/db/schema.js';
import { DEMO_USER_ID } from '../src/lib/server/db/schema.js';
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

/**
 * Ensure the demo user exists in auth.users. The recipes migration also
 * provisions this row on a fresh DB, but seed.ts may be invoked against a
 * DB that was created with `db:push` only (no migrations), so we make this
 * idempotent here too.
 */
async function ensureDemoUser() {
  await db.execute(sql`
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token,
      email_change, email_change_token_new, recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      ${DEMO_USER_ID}::uuid,
      'authenticated',
      'authenticated',
      'demo@grain-of-salt.local',
      crypt('demo-password-not-used', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Demo User"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do nothing
  `);
}

async function seed() {
  console.log('🌱 Seeding database...');

  await ensureDemoUser();

  // Idempotent: clear before re-seeding. parentId ON DELETE CASCADE handles
  // chain descendants when we delete the root.
  await db.delete(recipeNodes);

  // -------------------------------------------------------------------------
  // Simple Omelette — top-level recipe (parentNodeId = null on its root).
  // -------------------------------------------------------------------------
  const simpleNodeId = uuidv4();
  await db.insert(recipeNodes).values({
    id: simpleNodeId,
    parentId: null,
    parentNodeId: null,
    ownerId: DEMO_USER_ID,
    name: 'Simple Omelette',
    label: 'initial recipe',
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
  });

  // -------------------------------------------------------------------------
  // French Omelette — parent recipe is Simple's node. Classic French style:
  // more butter (used for basting), low heat, constant stirring, no browning.
  // Only the changes (deltas) from Simple are stored here.
  // -------------------------------------------------------------------------
  await db.insert(recipeNodes).values({
    id: uuidv4(),
    parentId: simpleNodeId,
    parentNodeId: null,
    ownerId: DEMO_USER_ID,
    name: 'French Omelette',
    label: 'bump butter, add chives; cook low and slow, no browning',
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
  });

  // -------------------------------------------------------------------------
  // Cheese Omelette — parent recipe is Simple's node.
  // -------------------------------------------------------------------------
  const cheeseNodeId = uuidv4();
  await db.insert(recipeNodes).values({
    id: cheeseNodeId,
    parentId: simpleNodeId,
    parentNodeId: null,
    ownerId: DEMO_USER_ID,
    name: 'Cheese Omelette',
    label: 'add cheese, fold with cheese inside',
    ingredientChanges: [
      ingredientAdd(CHEESE_INGREDIENT_ID, { name: 'Cheddar', amount: 50, unit: 'g' }),
    ],
    directionChanges: [
      directionEdit(
        SIMPLE_DIRECTION_IDS.foldServe,
        'When almost set, sprinkle cheese over half, fold and serve.',
      ),
    ],
  });

  // -------------------------------------------------------------------------
  // Denver Omelette — parent recipe is Cheese Omelette.
  // -------------------------------------------------------------------------
  await db.insert(recipeNodes).values({
    id: uuidv4(),
    parentId: cheeseNodeId,
    parentNodeId: null,
    ownerId: DEMO_USER_ID,
    name: 'Denver Omelette',
    label: 'add diced ham, bell pepper, and onion',
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
  });

  console.log(
    `✅ Seeded 4 recipes (Simple / French / Cheese / Denver) with correct parent-child relationships.`,
  );
}

// --- helpers ---------------------------------------------------------------

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
