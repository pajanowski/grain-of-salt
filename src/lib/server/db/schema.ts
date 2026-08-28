import { pgTable, serial, integer, text, uuid, timestamp, jsonb, type AnyPgColumn, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { IngredientChange, DirectionChange } from '../../obj/RecipeNode.svelte';

export const task = pgTable('task', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  priority: integer('priority').notNull().default(1)
});

/**
 * One node in a recipe's history. Forms a singly-linked list per recipe
 * via parentId. The head (parentId = null) is the recipe's root and
 * doubles as the recipe's identity — there is no separate recipes table.
 *
 * Hierarchy: a recipe's ROOT node may carry a `parentNodeId` pointing to
 * the tail node of its parent recipe — making this recipe a "child" of
 * that one. Null on top-level recipes and on non-root nodes.
 *
 * The `name` field is denormalized — every node in a recipe carries the
 * same recipe name — so the API can answer "what recipe is this node
 * part of?" without joining through a recipes table.
 */
export const recipeNodes = pgTable('recipe_nodes', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id').references((): AnyPgColumn => recipeNodes.id, { onDelete: 'cascade' }),
  parentNodeId: uuid('parent_node_id').references((): AnyPgColumn => recipeNodes.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  label: text('label'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  ingredientChanges: jsonb('ingredient_changes').$type<IngredientChange[]>().notNull().default([]),
  directionChanges: jsonb('direction_changes').$type<DirectionChange[]>().notNull().default([]),
}, (table) => ({
  // parentNodeId may only be set on roots (parentId is null).
  parentNodeOnlyOnRoot: check(
    'parent_node_only_on_root',
    sql`${table.parentNodeId} IS NULL OR ${table.parentId} IS NULL`,
  ),
}));

export type InsertRecipeNode = typeof recipeNodes.$inferInsert;
export type SelectRecipeNode = typeof recipeNodes.$inferSelect;

/**
 * Public-side user profile. The matching `auth.users` row is created/managed
 * by Supabase Auth; this table holds app-level fields and is auto-populated
 * by a trigger defined in supabase/migrations.
 *
 * Note: guest sessions in this project are cookie-only — they have NO row in
 * `auth.users` and therefore NO row here. Only "real" (email) users appear.
 */
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type InsertProfile = typeof profiles.$inferInsert;
export type SelectProfile = typeof profiles.$inferSelect;
