import type { RecipeNode, IngredientChange, DirectionChange } from './obj/RecipeNode.svelte';
import type { RecipeSummary } from './server/bo/recipenodesbo';

export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

export const SEED_SIMPLE_ID = '00000000-0000-0000-0000-000000000010';
export const SEED_FRENCH_ID = '00000000-0000-0000-0000-000000000020';
export const SEED_CHEESE_ID = '00000000-0000-0000-0000-000000000030';
export const SEED_DENVER_ID = '00000000-0000-0000-0000-000000000040';
export const SEED_SPICY_DENVER_ID = '00000000-0000-0000-0000-000000000050';
export const SEED_BOUILLABAISSE_ID = '00000000-0000-0000-0000-000000000101';

const SIMPLE_ING_EGGS = '00000000-0001-0000-0000-000000000001';
const SIMPLE_ING_BUTTER = '00000000-0001-0000-0000-000000000002';
const SIMPLE_ING_SALT = '00000000-0001-0000-0000-000000000003';

const SIMPLE_DIR_BEAT = '00000000-0002-0000-0000-000000000001';
const SIMPLE_DIR_MELT = '00000000-0002-0000-0000-000000000002';
const SIMPLE_DIR_COOK = '00000000-0002-0000-0000-000000000003';
const SIMPLE_DIR_FOLD = '00000000-0002-0000-0000-000000000004';

const CHEESE_ING_CHEDDAR = '00000000-0001-0000-0000-000000000004';
const FRENCH_ING_CHIVES = '00000000-0001-0000-0000-000000000005';

const DENVER_ING_HAM = '00000000-0001-0000-0000-000000000006';
const DENVER_ING_PEPPER = '00000000-0001-0000-0000-000000000007';
const DENVER_ING_ONION = '00000000-0001-0000-0000-000000000008';

const SPICY_ING_JALAPENO = '00000000-0001-0000-0000-000000000009';

export const SEED_NODES: RecipeNode[] = [
	{
		id: SEED_SIMPLE_ID,
		name: 'Simple Omelette',
		parentId: null,
		timestamp: new Date('2026-01-01T00:00:00Z'),
		author: 'Demo Chef',
		source: null,
		isPublic: true,
		isFavorite: false,
		imagePath: null,
		ingredientChanges: [
			{
				id: '00000000-0003-0000-0000-000000000001',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: SIMPLE_ING_EGGS, name: 'Eggs', amount: 3, unit: '' }
			},
			{
				id: '00000000-0003-0000-0000-000000000002',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: SIMPLE_ING_BUTTER, name: 'Butter', amount: 1, unit: 'tbsp' }
			},
			{
				id: '00000000-0003-0000-0000-000000000003',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: SIMPLE_ING_SALT, name: 'Salt', amount: 1, unit: 'pinch' }
			}
		],
		directionChanges: [
			{
				id: '00000000-0004-0000-0000-000000000001',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: SIMPLE_DIR_BEAT, body: 'Beat eggs with salt.' }
			},
			{
				id: '00000000-0004-0000-0000-000000000002',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: SIMPLE_DIR_MELT, body: 'Melt butter in a pan over medium heat.' }
			},
			{
				id: '00000000-0004-0000-0000-000000000003',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: SIMPLE_DIR_COOK, body: 'Pour in eggs, cook, stirring gently until set.' }
			},
			{
				id: '00000000-0004-0000-0000-000000000004',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: SIMPLE_DIR_FOLD, body: 'Fold in half and serve.' }
			}
		]
	},
	{
		id: SEED_FRENCH_ID,
		name: 'French Omelette',
		parentId: SEED_SIMPLE_ID,
		timestamp: new Date('2026-01-01T01:00:00Z'),
		author: 'Demo Chef',
		source: null,
		isPublic: false,
		isFavorite: true,
		imagePath: null,
		ingredientChanges: [
			{
				id: '00000000-0003-0000-0000-000000000010',
				changeType: 'edit',
				targetId: SIMPLE_ING_BUTTER,
				note: 'Double butter for basting',
				body: { id: SIMPLE_ING_BUTTER, name: 'Butter', amount: 2, unit: 'tbsp' }
			},
			{
				id: '00000000-0003-0000-0000-000000000011',
				changeType: 'add',
				targetId: null,
				note: 'Fresh herbs',
				body: { id: FRENCH_ING_CHIVES, name: 'Chives', amount: 1, unit: 'tbsp' }
			}
		],
		directionChanges: [
			{
				id: '00000000-0004-0000-0000-000000000010',
				changeType: 'edit',
				targetId: SIMPLE_DIR_MELT,
				note: 'Low heat',
				body: { id: SIMPLE_DIR_MELT, body: 'Melt butter over low heat until foamy.' }
			},
			{
				id: '00000000-0004-0000-0000-000000000011',
				changeType: 'edit',
				targetId: SIMPLE_DIR_COOK,
				note: 'Constant stirring',
				body: {
					id: SIMPLE_DIR_COOK,
					body: 'Pour in eggs and stir constantly with fork flat. Do not brown.'
				}
			},
			{
				id: '00000000-0004-0000-0000-000000000012',
				changeType: 'edit',
				targetId: SIMPLE_DIR_FOLD,
				note: null,
				body: {
					id: SIMPLE_DIR_FOLD,
					body: 'When surface is just set and creamy, fold in thirds and roll onto plate.'
				}
			}
		]
	},
	{
		id: SEED_CHEESE_ID,
		name: 'Cheese Omelette',
		parentId: SEED_SIMPLE_ID,
		timestamp: new Date('2026-01-01T02:00:00Z'),
		author: 'Demo Chef',
		source: null,
		isPublic: false,
		isFavorite: false,
		imagePath: null,
		ingredientChanges: [
			{
				id: '00000000-0003-0000-0000-000000000020',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: CHEESE_ING_CHEDDAR, name: 'Cheddar Cheese', amount: 50, unit: 'g' }
			}
		],
		directionChanges: [
			{
				id: '00000000-0004-0000-0000-000000000020',
				changeType: 'edit',
				targetId: SIMPLE_DIR_FOLD,
				note: null,
				body: {
					id: SIMPLE_DIR_FOLD,
					body: 'When almost set, sprinkle cheese over half, fold and serve.'
				}
			}
		]
	},
	{
		id: SEED_DENVER_ID,
		name: 'Denver Omelette',
		parentId: SEED_CHEESE_ID,
		timestamp: new Date('2026-01-01T03:00:00Z'),
		author: 'Demo Chef',
		source: null,
		isPublic: false,
		isFavorite: false,
		imagePath: null,
		ingredientChanges: [
			{
				id: '00000000-0003-0000-0000-000000000030',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: DENVER_ING_HAM, name: 'Diced Ham', amount: 50, unit: 'g' }
			},
			{
				id: '00000000-0003-0000-0000-000000000031',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: DENVER_ING_PEPPER, name: 'Green Bell Pepper', amount: 0.25, unit: 'cup' }
			},
			{
				id: '00000000-0003-0000-0000-000000000032',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: DENVER_ING_ONION, name: 'Diced Onion', amount: 2, unit: 'tbsp' }
			}
		],
		directionChanges: [
			{
				id: '00000000-0004-0000-0000-000000000030',
				changeType: 'add',
				targetId: null,
				note: null,
				body: {
					id: '00000000-0002-0000-0000-000000000010',
					body: 'Sauté ham, bell pepper, and onion in butter before adding eggs.'
				}
			}
		]
	},
	{
		id: SEED_SPICY_DENVER_ID,
		name: 'Spicy Denver Omelette',
		parentId: SEED_DENVER_ID,
		timestamp: new Date('2026-01-01T04:00:00Z'),
		author: 'Demo Chef',
		source: null,
		isPublic: false,
		isFavorite: true,
		imagePath: null,
		ingredientChanges: [
			{
				id: '00000000-0003-0000-0000-000000000040',
				changeType: 'add',
				targetId: null,
				note: 'Fresh heat',
				body: { id: SPICY_ING_JALAPENO, name: 'Jalapeño', amount: 1, unit: 'tbsp' }
			}
		],
		directionChanges: [
			{
				id: '00000000-0004-0000-0000-000000000040',
				changeType: 'edit',
				targetId: '00000000-0002-0000-0000-000000000010',
				note: null,
				body: {
					id: '00000000-0002-0000-0000-000000000010',
					body: 'Sauté ham, pepper, onion, and jalapeño until fragrant.'
				}
			}
		]
	},
	{
		id: SEED_BOUILLABAISSE_ID,
		name: "Auguste's Bouillabaisse",
		parentId: null,
		timestamp: new Date('2026-01-01T05:00:00Z'),
		author: 'Chef Auguste',
		source: 'Marseille',
		isPublic: true,
		isFavorite: false,
		imagePath: null,
		ingredientChanges: [
			{
				id: '00000000-0003-0000-0000-000000000101',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: '00000000-0001-0000-0000-000000000101', name: 'Mixed Fish & Shellfish', amount: 800, unit: 'g' }
			},
			{
				id: '00000000-0003-0000-0000-000000000102',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: '00000000-0001-0000-0000-000000000102', name: 'Saffron', amount: 1, unit: 'pinch' }
			}
		],
		directionChanges: [
			{
				id: '00000000-0004-0000-0000-000000000101',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: '00000000-0002-0000-0000-000000000101', body: 'Simmer broth with aromatic herbs and saffron.' }
			},
			{
				id: '00000000-0004-0000-0000-000000000102',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: '00000000-0002-0000-0000-000000000102', body: 'Poach seafood gently until just cooked through.' }
			}
		]
	}
];

export const SEED_RECIPES: RecipeSummary[] = [
	{ id: SEED_SIMPLE_ID, name: 'Simple Omelette', parentId: null },
	{ id: SEED_FRENCH_ID, name: 'French Omelette', parentId: SEED_SIMPLE_ID },
	{ id: SEED_CHEESE_ID, name: 'Cheese Omelette', parentId: SEED_SIMPLE_ID },
	{ id: SEED_DENVER_ID, name: 'Denver Omelette', parentId: SEED_CHEESE_ID },
	{ id: SEED_SPICY_DENVER_ID, name: 'Spicy Denver Omelette', parentId: SEED_DENVER_ID },
	{ id: SEED_BOUILLABAISSE_ID, name: "Auguste's Bouillabaisse", parentId: null }
];
