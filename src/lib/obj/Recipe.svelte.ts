import { v4 as uuid } from 'uuid';

export interface Ingredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
  note?: string | null;
  /**
   * Storage paths (relative to the recipe-images bucket) for images
   * attached to this ingredient. Multiple images allowed per row —
   * e.g. raw, sliced, plated.
   *
   * Replay contract (applyNodes): null/missing on a change body
   * means "fall through to ancestor's set"; an empty array means
   * "cleared by this change"; a populated array means "replace with
   * this set". The "Inherit images from parent" button on edit forms
   * populates this with an explicit copy of the inherited set.
   */
  imagePaths?: string[] | null;
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
  note?: string | null;
  /**
   * Storage paths (relative to the recipe-images bucket) for images
   * attached to this direction. Same null/empty/[...] semantics as
   * Ingredient.imagePaths — see Ingredient for the replay contract.
   */
  imagePaths?: string[] | null;
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
