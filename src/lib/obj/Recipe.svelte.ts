import { v4 as uuid } from 'uuid';

export class Ingredient {
  id: string;
  name: string;
  amount: number;
  unit: string;

  constructor(id: string | null, name: string, amount: number, unit: string) {
    this.id = id ?? uuid();
    this.name = name;
    this.amount = amount;
    this.unit = unit;
  }

  static Empty(): Ingredient {
    return new Ingredient(null, '', 0, '');
  }
}

export class Direction {
  id: string;
  body: string;

  constructor(id: string | null, body: string) {
    this.id = id ?? uuid();
    this.body = body;
  }

  static Empty(): Direction {
    return new Direction(null, '');
  }
}

export class Recipe {
  id: string;
  name: string;
  ingredients: Ingredient[];
  directions: Direction[];

  constructor(name: string, id?: string, ingredients: Ingredient[] = [], directions: Direction[] = []) {
    this.id = id ?? uuid();
    this.name = name;
    this.ingredients = ingredients;
    this.directions = directions;
  }
}
