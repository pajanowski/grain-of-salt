import { eq } from 'drizzle-orm';
import { db } from './index';
import { recipe, ingredients, directions } from './schema';
import type { SelectRecipe } from './schema';
import type { InferSelectModel } from 'drizzle-orm';

export type Ingredient = InferSelectModel<typeof ingredients>;
export type Direction = InferSelectModel<typeof directions>;

export type CompleteRecipe = SelectRecipe & {
  ingredients: Ingredient[];
  directions: Direction[];
};

export async function getAllRecipes(): Promise<SelectRecipe[]> {
  return db.select().from(recipe);
}

export async function getRecipeById(id: string) {
  return db.select().from(recipe).where(eq(recipe.id, id)).limit(1);
}

export async function getCompleteRecipeById(id: string): Promise<CompleteRecipe | null> {
  const [recipeResult, ingredientsResult, directionsResult] = await Promise.all([
    getRecipeById(id),
    getIngredientsByRecipeId(id),
    getDirectionsByRecipeId(id)
  ]);
  
  const recipe = recipeResult[0];
  if (!recipe) return null;
  
  return {
    ...recipe,
    ingredients: ingredientsResult,
    directions: directionsResult
  };
}

export async function getIngredientsByRecipeId(recipeId: string) {
  return db.select().from(ingredients).where(eq(ingredients.recipeId, recipeId));
}

export async function getDirectionsByRecipeId(recipeId: string) {
  return db.select().from(directions).where(eq(directions.recipeId, recipeId));
}

