	import { v4 as uuid } from 'uuid';

	export class Ingredient {
		id: string = uuid();
		name: string;
		amount: number;
		unit: string;
		constructor(name: string, amount: number, unit: string) {
			this.id = uuid();
			this.name = name;
			this.amount = amount;
			this.unit = unit;
		}

		static Empty(): Ingredient {
			return new Ingredient('', 0, '');
		}
	}

	export class Direction {
		id: string = uuid();
		body: string;
		constructor(body: string) {
			this.body = body;
		}
	}

	export class Recipe {
		id: string = uuid();
		name: string;
		ingredients: Ingredient[] = $state([]);
		directions: Direction[] = [];

		constructor(name: string) {
			this.name = name;
		}
	}
