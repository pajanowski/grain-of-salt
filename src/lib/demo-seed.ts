import type { RecipeNode, IngredientChange, DirectionChange } from './obj/RecipeNode.svelte';
import type { RecipeSummary } from './server/bo/recipenodesbo';

export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

export const SEED_SIMPLE_ID = '00000000-0000-0000-0000-000000000010';
export const SEED_FRENCH_ID = '00000000-0000-0000-0000-000000000020';
export const SEED_CHEESE_ID = '00000000-0000-0000-0000-000000000030';
export const SEED_DENVER_ID = '00000000-0000-0000-0000-000000000040';
export const SEED_SPICY_DENVER_ID = '00000000-0000-0000-0000-000000000050';
export const SEED_BOUILLABAISSE_ID = '00000000-0000-0000-0000-000000000101';
export const SEED_BOUILL_WEEKNIGHT_ID = '00000000-0000-0000-0000-000000000111';
export const SEED_BOUILL_ROUILLE_ID = '00000000-0000-0000-0000-000000000121';
export const SEED_BOUILL_ONEPOT_ID = '00000000-0000-0000-0000-000000000122';
export const SEED_BOUILL_SPICY_ID = '00000000-0000-0000-0000-000000000131';
export const SEED_BOUILL_PROVENCAL_ID = '00000000-0000-0000-0000-000000000141';
export const SEED_BOUILL_FOR_TWO_ID = '00000000-0000-0000-0000-000000000151';

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

// Bouillabaisse ingredient ids (referenced by direction bodies via #refs)
const B_ING_FISH = '00000000-0001-0000-0000-000000000101';
const B_ING_SHRIMP = '00000000-0001-0000-0000-000000000102';
const B_ING_MUSSELS = '00000000-0001-0000-0000-000000000103';
const B_ING_OIL = '00000000-0001-0000-0000-000000000104';
const B_ING_LEEK = '00000000-0001-0000-0000-000000000105';
const B_ING_FENNEL = '00000000-0001-0000-0000-000000000106';
const B_ING_ONION = '00000000-0001-0000-0000-000000000107';
const B_ING_GARLIC = '00000000-0001-0000-0000-000000000108';
const B_ING_TOMATO = '00000000-0001-0000-0000-000000000109';
const B_ING_SAFFRON = '00000000-0001-0000-0000-000000000110';
const B_ING_ORANGE = '00000000-0001-0000-0000-000000000111';
const B_ING_PASTIS = '00000000-0001-0000-0000-000000000112';
const B_ING_STOCK = '00000000-0001-0000-0000-000000000113';
const B_ING_PARSLEY = '00000000-0001-0000-0000-000000000116';
const B_ING_FROZEN = '00000000-0001-0000-0000-000000000118';
const B_ING_POTATO = '00000000-0001-0000-0000-000000000119';
const B_ING_BAGUETTE = '00000000-0001-0000-0000-000000000120';
const B_ING_MAYO = '00000000-0001-0000-0000-000000000121';
const B_ING_FLAKES = '00000000-0001-0000-0000-000000000122';
const B_ING_HERBS = '00000000-0001-0000-0000-000000000123';

export const SEED_NODES: RecipeNode[] = [
	{
		id: SEED_SIMPLE_ID,
		name: 'Simple Omelette',
		description: 'First version — the baseline three-ingredient omelette.',
		note: 'The house default. Cook low and slow; the pan should never scream.',
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
				body: { id: SIMPLE_DIR_BEAT, body: `Beat #${SIMPLE_ING_EGGS} with #${SIMPLE_ING_SALT}.` }
			},
			{
				id: '00000000-0004-0000-0000-000000000002',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: SIMPLE_DIR_MELT, body: `Melt #${SIMPLE_ING_BUTTER} in a pan over medium heat.` }
			},
			{
				id: '00000000-0004-0000-0000-000000000003',
				changeType: 'add',
				targetId: null,
				note: null,
				body: { id: SIMPLE_DIR_COOK, body: `Pour in #${SIMPLE_ING_EGGS}, cook, stirring gently until set.` }
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
		description: 'More butter, plus chives folded in at the end.',
		note: null,
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
				body: { id: SIMPLE_DIR_MELT, body: `Melt #${SIMPLE_ING_BUTTER} over low heat until foamy.` }
			},
			{
				id: '00000000-0004-0000-0000-000000000011',
				changeType: 'edit',
				targetId: SIMPLE_DIR_COOK,
				note: 'Constant stirring',
				body: {
					id: SIMPLE_DIR_COOK,
					body: `Pour in #${SIMPLE_ING_EGGS} and stir constantly with fork flat. Do not brown.`
				}
			},
			{
				id: '00000000-0004-0000-0000-000000000012',
				changeType: 'edit',
				targetId: SIMPLE_DIR_FOLD,
				note: null,
				body: {
					id: SIMPLE_DIR_FOLD,
					body: `When surface is just set and creamy, fold in thirds and roll onto plate. Top with #${FRENCH_ING_CHIVES}.`
				}
			}
		]
	},
	{
		id: SEED_CHEESE_ID,
		name: 'Cheese Omelette',
		description: 'Adds 50 g of cheddar to the simple base.',
		note: null,
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
					body: `When almost set, sprinkle #${CHEESE_ING_CHEDDAR} over half, fold and serve.`
				}
			}
		]
	},
	{
		id: SEED_DENVER_ID,
		name: 'Denver Omelette',
		description: 'Cheese base plus ham, bell pepper and onion.',
		note: 'A diner classic — chop the ham fine so it distributes evenly.',
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
					body: `Sauté #${DENVER_ING_HAM}, #${DENVER_ING_PEPPER}, and #${DENVER_ING_ONION} in #${SIMPLE_ING_BUTTER} before adding #${SIMPLE_ING_EGGS}.`
				}
			}
		]
	},
	{
		id: SEED_SPICY_DENVER_ID,
		name: 'Spicy Denver Omelette',
		description: 'Doubled the bell pepper and added cayenne heat.',
		note: null,
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
					body: `Sauté #${DENVER_ING_HAM}, #${DENVER_ING_PEPPER}, #${DENVER_ING_ONION}, and #${SPICY_ING_JALAPENO} until fragrant.`
				}
			}
		]
	},
	{
		id: SEED_BOUILLABAISSE_ID,
		name: "Auguste's Bouillabaisse",
		description: 'Imported from marmiton.org — the full Marseillaise fish stew.',
		note: 'Import. Saffron and orange peel are non-negotiable; everything else is negotiable.',
		parentId: null,
		timestamp: new Date('2026-01-02T00:00:00Z'),
		author: 'Chef Auguste',
		source: 'marmiton.org',
		isPublic: true,
		isFavorite: false,
		imagePath: null,
		ingredientChanges: [
			{ id: '00000000-0003-0000-0000-000000000101', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000101', name: 'Mixed Fish & Shellfish (lingcod, sea bream)', amount: 800, unit: 'g' } },
			{ id: '00000000-0003-0000-0000-000000000102', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000102', name: 'Shrimp', amount: 200, unit: 'g' } },
			{ id: '00000000-0003-0000-0000-000000000103', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000103', name: 'Mussels', amount: 500, unit: 'g' } },
			{ id: '00000000-0003-0000-0000-000000000104', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000104', name: 'Olive Oil', amount: 4, unit: 'tbsp' } },
			{ id: '00000000-0003-0000-0000-000000000105', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000105', name: 'Leek', amount: 1, unit: '' } },
			{ id: '00000000-0003-0000-0000-000000000106', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000106', name: 'Fennel Bulb', amount: 1, unit: '' } },
			{ id: '00000000-0003-0000-0000-000000000107', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000107', name: 'Onion', amount: 1, unit: '' } },
			{ id: '00000000-0003-0000-0000-000000000108', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000108', name: 'Garlic', amount: 4, unit: 'cloves' } },
			{ id: '00000000-0003-0000-0000-000000000109', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000109', name: 'Canned Tomatoes', amount: 400, unit: 'g' } },
			{ id: '00000000-0003-0000-0000-000000000110', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000110', name: 'Saffron', amount: 1, unit: 'pinch' } },
			{ id: '00000000-0003-0000-0000-000000000111', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000111', name: 'Orange Peel', amount: 1, unit: 'strip' } },
			{ id: '00000000-0003-0000-0000-000000000112', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000112', name: 'Pastis', amount: 2, unit: 'tbsp' } },
			{ id: '00000000-0003-0000-0000-000000000113', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000113', name: 'Fish Stock', amount: 1.5, unit: 'l' } },
			{ id: '00000000-0003-0000-0000-000000000114', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000114', name: 'Salt', amount: 1, unit: 'tsp' } },
			{ id: '00000000-0003-0000-0000-000000000115', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000115', name: 'Black Pepper', amount: 0.5, unit: 'tsp' } },
			{ id: '00000000-0003-0000-0000-000000000116', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000116', name: 'Fresh Parsley', amount: 2, unit: 'tbsp' } }
		],
		directionChanges: [
			{ id: '00000000-0004-0000-0000-000000000101', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0002-0000-0000-000000000101', body: `Heat #${B_ING_OIL} in a large pot over medium heat.` } },
			{ id: '00000000-0004-0000-0000-000000000102', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0002-0000-0000-000000000102', body: `Sweat #${B_ING_LEEK}, #${B_ING_FENNEL}, #${B_ING_ONION}, and #${B_ING_GARLIC} until soft, about 8 minutes.` } },
			{ id: '00000000-0004-0000-0000-000000000103', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0002-0000-0000-000000000103', body: `Stir in #${B_ING_TOMATO}, #${B_ING_ORANGE}, and #${B_ING_SAFFRON}; cook 5 minutes.` } },
			{ id: '00000000-0004-0000-0000-000000000104', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0002-0000-0000-000000000104', body: `Pour in #${B_ING_STOCK} and #${B_ING_PASTIS}; bring to a simmer.` } },
			{ id: '00000000-0004-0000-0000-000000000105', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0002-0000-0000-000000000105', body: `Simmer uncovered for 20 minutes so the broth concentrates.` } },
			{ id: '00000000-0004-0000-0000-000000000106', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0002-0000-0000-000000000106', body: `Add #${B_ING_FISH} and #${B_ING_SHRIMP}; cook 5 minutes.` } },
			{ id: '00000000-0004-0000-0000-000000000107', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0002-0000-0000-000000000107', body: `Add #${B_ING_MUSSELS}; cover and steam until the shells open, 3-4 minutes.` } },
			{ id: '00000000-0004-0000-0000-000000000108', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0002-0000-0000-000000000108', body: `Rest off the heat for 5 minutes, then serve garnished with #${B_ING_PARSLEY}.` } }
		]
	},
	{
		id: SEED_BOUILL_WEEKNIGHT_ID,
		name: 'Weeknight Bouillabaisse',
		description: 'Frozen seafood mix and potato; simmer cut to 25 minutes.',
		note: null,
		parentId: SEED_BOUILLABAISSE_ID,
		timestamp: new Date('2026-01-02T01:00:00Z'),
		author: 'Demo Chef',
		source: null,
		isPublic: false,
		isFavorite: false,
		imagePath: null,
		ingredientChanges: [
			{ id: '00000000-0003-0000-0000-000000000117', changeType: 'add', targetId: null, note: 'Frozen mix saves the trip to the fishmonger', body: { id: '00000000-0001-0000-0000-000000000118', name: 'Frozen Seafood Mix', amount: 700, unit: 'g' } },
			{ id: '00000000-0003-0000-0000-000000000118', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000119', name: 'Yukon Gold Potato', amount: 2, unit: '' } }
		],
		directionChanges: [
			{ id: '00000000-0004-0000-0000-000000000109', changeType: 'edit', targetId: '00000000-0002-0000-0000-000000000106', note: null, body: { id: '00000000-0002-0000-0000-000000000106', body: `Add #${B_ING_FROZEN} and the diced #${B_ING_POTATO}; cook 8 minutes.` } },
			{ id: '00000000-0004-0000-0000-000000000110', changeType: 'edit', targetId: '00000000-0002-0000-0000-000000000105', note: null, body: { id: '00000000-0002-0000-0000-000000000105', body: 'Simmer uncovered for 15 minutes — the potato needs the head start.' } }
		]
	},
	{
		id: SEED_BOUILL_ROUILLE_ID,
		name: 'Bouillabaisse with Rouille',
		description: 'Homemade rouille served alongside the broth.',
		note: 'The rouille is best made while the stock simmers.',
		parentId: SEED_BOUILL_WEEKNIGHT_ID,
		timestamp: new Date('2026-01-02T02:00:00Z'),
		author: 'Demo Chef',
		source: null,
		isPublic: false,
		isFavorite: false,
		imagePath: null,
		ingredientChanges: [
			{ id: '00000000-0003-0000-0000-000000000119', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000120', name: 'Baguette', amount: 1, unit: '' } },
			{ id: '00000000-0003-0000-0000-000000000120', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000121', name: 'Mayonnaise', amount: 3, unit: 'tbsp' } }
		],
		directionChanges: [
			{ id: '00000000-0004-0000-0000-000000000111', changeType: 'add', targetId: null, note: 'Classic Marseille garnish', body: { id: '00000000-0002-0000-0000-000000000109', body: `Stir #${B_ING_MAYO} with a grated #${B_ING_GARLIC} clove for a quick rouille.` } },
			{ id: '00000000-0004-0000-0000-000000000112', changeType: 'edit', targetId: '00000000-0002-0000-0000-000000000108', note: null, body: { id: '00000000-0002-0000-0000-000000000108', body: `Rest off the heat for 5 minutes. Serve over toasted #${B_ING_BAGUETTE} with a dollop of rouille and #${B_ING_PARSLEY} on top.` } }
		]
	},
	{
		id: SEED_BOUILL_ONEPOT_ID,
		name: 'One-Pot Bouillabaisse',
		description: 'Dropped the rouille — fewer dishes, same broth.',
		note: null,
		parentId: SEED_BOUILL_ROUILLE_ID,
		timestamp: new Date('2026-01-02T03:00:00Z'),
		author: 'Demo Chef',
		source: null,
		isPublic: false,
		isFavorite: false,
		imagePath: null,
		ingredientChanges: [
			{ id: '00000000-0003-0000-0000-000000000121', changeType: 'remove', targetId: '00000000-0001-0000-0000-000000000121', note: 'Skip the rouille — fewer dishes', body: null }
		],
		directionChanges: [
			{ id: '00000000-0004-0000-0000-000000000113', changeType: 'remove', targetId: '00000000-0002-0000-0000-000000000109', note: null, body: null },
			{ id: '00000000-0004-0000-0000-000000000114', changeType: 'edit', targetId: '00000000-0002-0000-0000-000000000108', note: null, body: { id: '00000000-0002-0000-0000-000000000108', body: `Rest off the heat for 5 minutes, then serve straight from the pot with #${B_ING_PARSLEY} on top.` } }
		]
	},
	{
		id: SEED_BOUILL_SPICY_ID,
		name: 'Spicy Bouillabaisse with Rouille',
		description: 'Rouille kept, chili flakes added to the broth.',
		note: null,
		parentId: SEED_BOUILL_ROUILLE_ID,
		timestamp: new Date('2026-01-02T04:00:00Z'),
		author: 'Demo Chef',
		source: null,
		isPublic: false,
		isFavorite: true,
		imagePath: null,
		ingredientChanges: [
			{ id: '00000000-0003-0000-0000-000000000122', changeType: 'add', targetId: null, note: 'Heat', body: { id: '00000000-0001-0000-0000-000000000122', name: 'Red Pepper Flakes', amount: 1, unit: 'tsp' } }
		],
		directionChanges: [
			{ id: '00000000-0004-0000-0000-000000000115', changeType: 'edit', targetId: '00000000-0002-0000-0000-000000000103', note: null, body: { id: '00000000-0002-0000-0000-000000000103', body: `Stir in #${B_ING_TOMATO}, #${B_ING_ORANGE}, #${B_ING_SAFFRON}, and #${B_ING_FLAKES}; cook 5 minutes.` } }
		]
	},
	{
		id: SEED_BOUILL_PROVENCAL_ID,
		name: 'Provençal Spicy Bouillabaisse',
		description: 'Fresh herbs and pastis bumped up for a punchier broth.',
		note: null,
		parentId: SEED_BOUILL_SPICY_ID,
		timestamp: new Date('2026-01-02T05:00:00Z'),
		author: 'Demo Chef',
		source: null,
		isPublic: false,
		isFavorite: false,
		imagePath: null,
		ingredientChanges: [
			{ id: '00000000-0003-0000-0000-000000000123', changeType: 'add', targetId: null, note: null, body: { id: '00000000-0001-0000-0000-000000000123', name: 'Herbes de Provence', amount: 1, unit: 'tsp' } }
		],
		directionChanges: [
			{ id: '00000000-0004-0000-0000-000000000116', changeType: 'edit', targetId: '00000000-0002-0000-0000-000000000104', note: null, body: { id: '00000000-0002-0000-0000-000000000104', body: `Pour in #${B_ING_STOCK} and #${B_ING_PASTIS}; season with #${B_ING_HERBS} and bring to a simmer.` } }
		]
	},
	{
		id: SEED_BOUILL_FOR_TWO_ID,
		name: 'Provençal Bouillabaisse for Two',
		description: 'Halved everything — a dinner-party stew for two.',
		note: null,
		parentId: SEED_BOUILL_PROVENCAL_ID,
		timestamp: new Date('2026-01-02T06:00:00Z'),
		author: 'Demo Chef',
		source: null,
		isPublic: false,
		isFavorite: false,
		imagePath: null,
		ingredientChanges: [
			{ id: '00000000-0003-0000-0000-000000000124', changeType: 'edit', targetId: '00000000-0001-0000-0000-000000000101', note: 'Halved for two servings', body: { id: '00000000-0001-0000-0000-000000000101', name: 'Mixed Fish & Shellfish (lingcod, sea bream)', amount: 400, unit: 'g' } },
			{ id: '00000000-0003-0000-0000-000000000125', changeType: 'edit', targetId: '00000000-0001-0000-0000-000000000113', note: null, body: { id: '00000000-0001-0000-0000-000000000113', name: 'Fish Stock', amount: 750, unit: 'ml' } }
		],
		directionChanges: []
	}
];

export const SEED_RECIPES: RecipeSummary[] = [
	{ id: SEED_SIMPLE_ID, name: 'Simple Omelette', parentId: null },
	{ id: SEED_FRENCH_ID, name: 'French Omelette', parentId: SEED_SIMPLE_ID },
	{ id: SEED_CHEESE_ID, name: 'Cheese Omelette', parentId: SEED_SIMPLE_ID },
	{ id: SEED_DENVER_ID, name: 'Denver Omelette', parentId: SEED_CHEESE_ID },
	{ id: SEED_SPICY_DENVER_ID, name: 'Spicy Denver Omelette', parentId: SEED_DENVER_ID },
	{ id: SEED_BOUILLABAISSE_ID, name: "Auguste's Bouillabaisse", parentId: null },
	{ id: SEED_BOUILL_WEEKNIGHT_ID, name: 'Weeknight Bouillabaisse', parentId: SEED_BOUILLABAISSE_ID },
	{ id: SEED_BOUILL_ROUILLE_ID, name: 'Bouillabaisse with Rouille', parentId: SEED_BOUILL_WEEKNIGHT_ID },
	{ id: SEED_BOUILL_ONEPOT_ID, name: 'One-Pot Bouillabaisse', parentId: SEED_BOUILL_ROUILLE_ID },
	{ id: SEED_BOUILL_SPICY_ID, name: 'Spicy Bouillabaisse with Rouille', parentId: SEED_BOUILL_ROUILLE_ID },
	{ id: SEED_BOUILL_PROVENCAL_ID, name: 'Provençal Spicy Bouillabaisse', parentId: SEED_BOUILL_SPICY_ID },
	{ id: SEED_BOUILL_FOR_TWO_ID, name: 'Provençal Bouillabaisse for Two', parentId: SEED_BOUILL_PROVENCAL_ID }
];
