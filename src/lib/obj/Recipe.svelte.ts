import { v4 as uuid } from 'uuid';

export interface Ingredient {
  id: string;
  name: string;
  amount: number;
  unit: string;

}

export function NewIngredient(id: string | null, name: string, amount: number, unit: string) {
  return {
    id: id ?? uuid(),
    name,
    amount,
    unit

  }
}

export function EmptyIngredient(): Ingredient {
  return NewIngredient(null, '', 0, '');
}

export interface Direction {
  id: string;
  body: string;
}
export function NewDirection(id: string | null, body: string) {
  return {
    id: id ?? uuid(),
    body
  }
}

export function EmptyDirection(): Direction {
  return NewDirection(null, '');
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: Ingredient[];
  directions: Direction[];
}

export function NewRecipe(name: string, id?: string, ingredients: Ingredient[] = [], directions: Direction[] = []) {
  return {
    id: id ?? uuid(),
    name,
    ingredients,
    directions
  }
}

export function EmptyRecipe(): Recipe {
  return NewRecipe("");
}
