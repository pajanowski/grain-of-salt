import { pgTable, serial, integer, text, uuid, foreignKey, numeric } from 'drizzle-orm/pg-core';

export const task = pgTable('task', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  priority: integer('priority').notNull().default(1)
});

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
})

export const ingredients = pgTable('ingredients', {
  id: uuid().defaultRandom(),
  recipeId: uuid().references(() => recipes.id),
  name: text('name').notNull(),
  amount: numeric('amount'),
  unit: text('unit'),
})


export const directions = pgTable('directions', {
  id: uuid().defaultRandom(),
  recipeId: uuid().references(() => recipes.id),
  body: text('body').notNull(),
})

export type InsertRecipe = typeof recipes.$inferInsert;
export type SelectRecipe = typeof recipes.$inferSelect;
