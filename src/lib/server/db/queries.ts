import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from './index';
import { recipes, ingredients, directions } from './schema';
import type { SelectRecipe } from './schema';
import type { InferSelectModel } from 'drizzle-orm';

export type RecipeDTO = InferSelectModel<typeof recipes>
export type IngredientDTO = InferSelectModel<typeof ingredients>;
export type DirectionDTO = InferSelectModel<typeof directions>;

export type IngredientPOJO = { id: string; name: string; amount: number; unit: string };
export type DirectionPOJO = { id: string; body: string };
export type RecipePOJO = { id: string; name: string; ingredients: IngredientPOJO[]; directions: DirectionPOJO[] };

function toUiIngredient(row: IngredientDTO) {
  return {
    id: row.id ?? uuid(),
    name: row.name,
    amount: row.amount != null ? Number(row.amount) : 0,
    unit: row.unit ?? ''
  };
}

function toUiDirection(row: DirectionDTO) {
  return {
    id: row.id ?? uuid(),
    body: row.body
  };
}

function toDbIngredient(ing: IngredientPOJO, recipeId: string): IngredientDTO {
  return {
    id: ing.id || null,
    recipeId,
    name: ing.name,
    amount: String(ing.amount),
    unit: ing.unit || null
  };
}

function toDbDirection(dir: DirectionPOJO, recipeId: string): DirectionDTO {
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

export async function getIngredientsByRecipeId(recipeId: string): Promise<IngredientPOJO[]> {
  const result = await db.select().from(ingredients).where(eq(ingredients.recipeId, recipeId));
  return result.map(toUiIngredient);
}

export async function getDirectionsByRecipeId(recipeId: string): Promise<DirectionPOJO[]> {
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

export async function saveRecipe(recipe: RecipePOJO): Promise<RecipePOJO> {
  await db.delete(ingredients).where(eq(ingredients.recipeId, recipe.id));
  await db.delete(directions).where(eq(directions.recipeId, recipe.id));

  const ingredientRows = recipe.ingredients.map((ing: IngredientPOJO) => toDbIngredient(ing, recipe.id));
  const directionRows = recipe.directions.map((dir: DirectionPOJO) => toDbDirection(dir, recipe.id));

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

  return {
    id: recipe.id,
    name: recipe.name,
    ingredients: insertedIngredients.map(toUiIngredient),
    directions: insertedDirections.map(toUiDirection)
  };
}
