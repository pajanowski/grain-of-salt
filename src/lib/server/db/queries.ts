import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from './index';
import { recipes, ingredients, directions } from './schema';
import type { SelectRecipe } from './schema';
import type { InferSelectModel } from 'drizzle-orm';
import { type Ingredient, type Direction, type Recipe, NewIngredient, NewDirection, NewRecipe } from '$lib/obj/Recipe.svelte';

export type RecipeDTO = InferSelectModel<typeof recipes>
export type IngredientDTO = InferSelectModel<typeof ingredients>;
export type DirectionDTO = InferSelectModel<typeof directions>;

function toUiIngredient(row: IngredientDTO): Ingredient {
  return NewIngredient(
    row.id,
    row.name,
    row.amount != null ? Number(row.amount) : 0,
    row.unit ?? ''
  );
}

function toUiDirection(row: DirectionDTO): Direction {
  return NewDirection(row.id, row.body);
}

function toDbIngredient(ing: Ingredient, recipeId: string): IngredientDTO {
  return {
    id: ing.id || null,
    recipeId,
    name: ing.name,
    amount: String(ing.amount),
    unit: ing.unit || null
  };
}

function toDbDirection(dir: Direction, recipeId: string): DirectionDTO {
  return {
    id: dir.id || null,
    recipeId,
    body: dir.body
  };
}

export async function getAllRecipes(): Promise<SelectRecipe[]> {
  return db.select().from(recipes);
}

export async function getRecipeById(id: string) {
  return db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
}

export async function getIngredientsByRecipeId(recipeId: string): Promise<Ingredient[]> {
  const result = await db.select().from(ingredients).where(eq(ingredients.recipeId, recipeId));
  return result.map(toUiIngredient);
}

export async function getDirectionsByRecipeId(recipeId: string): Promise<Direction[]> {
  const result = await db.select().from(directions).where(eq(directions.recipeId, recipeId));
  return result.map(toUiDirection);
}

export async function getCompleteRecipeById(id: string) {
  const [recipeResult, ingredientsResult, directionsResult] = await Promise.all([
    getRecipeById(id),
    getIngredientsByRecipeId(id),
    getDirectionsByRecipeId(id)
  ]);

  const recipeData = recipeResult[0];
  if (!recipeData) return null;

  return {
    id: recipeData.id,
    name: recipeData.name,
    ingredients: ingredientsResult,
    directions: directionsResult
  };
}

export async function saveRecipe(recipe: Recipe): Promise<Recipe> {
  await db.delete(ingredients).where(eq(ingredients.recipeId, recipe.id));
  await db.delete(directions).where(eq(directions.recipeId, recipe.id));

  const ingredientRows = recipe.ingredients.map(ing => toDbIngredient(ing, recipe.id));
  const directionRows = recipe.directions.map(dir => toDbDirection(dir, recipe.id));

  let insertedIngredients: IngredientDTO[] = [];
  let insertedDirections: DirectionDTO[] = [];

  if (ingredientRows.length) {
    const result = await db.insert(ingredients).values(ingredientRows).returning();
    insertedIngredients = result;
  }

  if (directionRows.length) {
    const result = await db.insert(directions).values(directionRows).returning();
    insertedDirections = result;
  }

  return NewRecipe(
    recipe.name,
    recipe.id,
    insertedIngredients.map(toUiIngredient),
    insertedDirections.map(toUiDirection)
  );
}
