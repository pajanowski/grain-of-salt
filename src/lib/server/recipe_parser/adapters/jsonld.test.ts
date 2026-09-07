import { describe, it, expect } from 'vitest';
import {
	parseIngredientString,
	extractRecipeFromJsonLd
} from './jsonld';
import { formatAmount } from '$lib/formatAmount';

describe('parseIngredientString', () => {
	const cases: [string, { name: string; amount: number; unit: string }][] = [
		// ASCII fractions
		['1/2 tsp. ground coriander', { name: 'ground coriander', amount: 0.5, unit: 'tsp' }],
		['1/4 cup flour', { name: 'flour', amount: 0.25, unit: 'cup' }],
		['3/4 lb beef', { name: 'beef', amount: 0.75, unit: 'lb' }],
		// Unicode fractions
		['½ cup mayonnaise', { name: 'mayonnaise', amount: 0.5, unit: 'cup' }],
		['¼ tsp salt', { name: 'salt', amount: 0.25, unit: 'tsp' }],
		// Mixed number with unicode fraction
		['1½ cups water', { name: 'water', amount: 1.5, unit: 'cups' }],
		// Mixed number with ASCII fraction
		['1 1/2 cups flour', { name: 'flour', amount: 1.5, unit: 'cups' }],
		// Units with periods
		['2 Tbsp. adobo sauce', { name: 'adobo sauce', amount: 2, unit: 'Tbsp' }],
		['1 tsp. vanilla', { name: 'vanilla', amount: 1, unit: 'tsp' }],
		['8 oz. cream cheese', { name: 'cream cheese', amount: 8, unit: 'oz' }],
		// Compound digit-unit patterns (size designations)
		['1 8-oz. block cheese', { name: 'block cheese', amount: 8, unit: 'oz' }],
		['1 15-oz. can black beans', { name: 'can black beans', amount: 15, unit: 'oz' }],
		// Modifier units (medium, large)
		['1 medium red onion', { name: 'red onion', amount: 1, unit: 'medium' }],
		['1 large egg', { name: 'egg', amount: 1, unit: 'large' }],
		// Decimal amounts
		['1.5 cups sugar', { name: 'sugar', amount: 1.5, unit: 'cups' }],
		// No amount or unit
		['Salt and pepper', { name: 'Salt and pepper', amount: 0, unit: '' }],
		['Plain breadcrumbs', { name: 'Plain breadcrumbs', amount: 0, unit: '' }],
		// Whitespace tolerance
		['  2  cups  milk  ', { name: 'milk', amount: 2, unit: 'cups' }],
		// Empty
		['', { name: '', amount: 0, unit: '' }]
	];

	for (const [input, expected] of cases) {
		it(`parses "${input}"`, () => {
			const r = parseIngredientString(input);
			expect({ name: r.name, amount: r.amount, unit: r.unit }).toEqual(expected);
		});
	}
});

describe('extractRecipeFromJsonLd', () => {
	it('extracts a basic Recipe', () => {
		const obj = {
			'@type': 'Recipe',
			name: 'Test Recipe',
			recipeIngredient: ['2 cups flour', '1 tsp salt'],
			recipeInstructions: [{ '@type': 'HowToStep', text: 'Mix dry ingredients.' }]
		};
		const result = extractRecipeFromJsonLd(obj);
		expect(result?.name).toBe('Test Recipe');
		expect(result?.ingredients).toEqual(['2 cups flour', '1 tsp salt']);
		expect(result?.instructions).toEqual(['Mix dry ingredients.']);
	});

	it('returns null for non-Recipe objects', () => {
		expect(extractRecipeFromJsonLd({ '@type': 'Person', name: 'X' })).toBeNull();
	});

	it('accepts schema.org URL @type', () => {
		const obj = {
			'@type': 'https://schema.org/Recipe',
			name: 'X',
			recipeIngredient: [],
			recipeInstructions: []
		};
		expect(extractRecipeFromJsonLd(obj)?.name).toBe('X');
	});

	it('handles HowToSection with nested HowToStep children', () => {
		const obj = {
			'@type': 'Recipe',
			name: 'Layer Cake',
			recipeIngredient: [],
			recipeInstructions: [
				{
					'@type': 'HowToSection',
					name: 'Cake',
					itemListElement: [
						{ '@type': 'HowToStep', text: 'Mix dry.' },
						{ '@type': 'HowToStep', text: 'Add wet.' }
					]
				}
			]
		};
		const result = extractRecipeFromJsonLd(obj);
		expect(result?.instructions).toEqual(['Mix dry.', 'Add wet.']);
	});

	it('extracts string author', () => {
		const obj = { '@type': 'Recipe', name: 'X', author: 'Chef A' };
		expect(extractRecipeFromJsonLd(obj)?.author).toBe('Chef A');
	});

	it('extracts Person author with name field', () => {
		const obj = { '@type': 'Recipe', name: 'X', author: { '@type': 'Person', name: 'Chef A' } };
		expect(extractRecipeFromJsonLd(obj)?.author).toBe('Chef A');
	});

	it('joins multiple authors with comma', () => {
		const obj = {
			'@type': 'Recipe',
			name: 'X',
			author: [{ '@type': 'Person', name: 'A' }, { '@type': 'Person', name: 'B' }]
		};
		expect(extractRecipeFromJsonLd(obj)?.author).toBe('A, B');
	});

	it('returns null when name is missing', () => {
		const obj = { '@type': 'Recipe', recipeIngredient: [], recipeInstructions: [] };
		expect(extractRecipeFromJsonLd(obj)).toBeNull();
	});
});

describe('formatAmount', () => {
	const cases: [number, string][] = [
		[0, ''],
		[1, '1'],
		[2, '2'],
		[0.5, '1/2'],
		[0.25, '1/4'],
		[0.75, '3/4'],
		[0.125, '1/8'],
		[0.333, '1/3'],
		[0.667, '2/3'],
		[0.42, '0.42'],
		[2.25, '2 1/4'],
		[3.7, '3.7']
	];

	for (const [input, expected] of cases) {
		it(`formats ${input} as "${expected}"`, () => {
			expect(formatAmount(input)).toBe(expected);
		});
	}
});
