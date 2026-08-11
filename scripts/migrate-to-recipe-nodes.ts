/**
 * One-shot migration: read every recipe's ingredients/directions from the
 * legacy tables and seed an initial root RecipeNode whose change list
 * materializes to that exact state (one 'add' per ingredient/direction).
 *
 * Idempotent: if a recipe already has a root node, it is skipped.
 *
 * After running this, the legacy ingredients/directions tables are unused
 * (the application reads exclusively from recipe_nodes). Drop them
 * separately if you want.
 *
 *   pnpm db:migrate-to-nodes
 */
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { v4 as uuid } from 'uuid';
import { eq } from 'drizzle-orm';
import { recipes, ingredients, directions, recipeNodes } from '../src/lib/server/db/schema.js';
// ingredients/directions imports are used below by the migration that reads
// from the legacy tables. Once that migration has been run on every
// environment, this script can be deleted along with the table definitions.
import type { IngredientChange, DirectionChange } from '../src/lib/obj/RecipeNode.svelte.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function migrate() {
  console.log('🔄 Migrating legacy ingredients/directions into recipe_nodes...');

  const allRecipes = await db.select().from(recipes);
  if (allRecipes.length === 0) {
    console.log('No recipes found — nothing to migrate.');
    return;
  }

  let migratedCount = 0;
  let skippedCount = 0;

  for (const recipe of allRecipes) {
    // Skip if this recipe already has a root node — user has history; don't clobber.
    const existing = await db
      .select({ id: recipeNodes.id })
      .from(recipeNodes)
      .where(eq(recipeNodes.recipeId, recipe.id))
      .limit(1);
    if (existing.length > 0) {
      skippedCount++;
      continue;
    }

    const ingRows = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.recipeId, recipe.id));

    const dirRows = await db
      .select()
      .from(directions)
      .where(eq(directions.recipeId, recipe.id));

    // Legacy ingredients rows don't have PKs on their id column — generate one
    // per row so the new node has stable targetIds.
    const ingredientChanges: IngredientChange[] = ingRows.map((row) => ({
      id: uuid(),
      changeType: 'add',
      targetId: null,
      note: null,
      body: {
        id: row.id ?? uuid(),
        name: row.name,
        amount: row.amount != null ? Number(row.amount) : 0,
        unit: row.unit ?? '',
      },
    }));

    const directionChanges: DirectionChange[] = dirRows.map((row) => ({
      id: uuid(),
      changeType: 'add',
      targetId: null,
      note: null,
      body: {
        id: row.id ?? uuid(),
        body: row.body,
      },
    }));

    await db.insert(recipeNodes).values({
      id: uuid(),
      recipeId: recipe.id,
      parentId: null,
      label: 'initial migration from legacy tables',
      ingredientChanges,
      directionChanges,
    });

    migratedCount++;
    console.log(
      `  ✓ ${recipe.name}: ${ingredientChanges.length} ingredients, ${directionChanges.length} directions`,
    );
  }

  console.log(
    `✅ Migration complete: ${migratedCount} migrated, ${skippedCount} skipped (already had history).`,
  );
}

migrate()
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
