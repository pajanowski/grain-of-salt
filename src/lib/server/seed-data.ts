/**
 * Static seed data for recipe nodes. Shared between the CLI seed script
 * (`scripts/seed.ts`) and the in-app seed API (`/mise/api/seed`).
 *
 * Exports `seedForUser(ownerId)` which wipes the user's existing nodes and
 * inserts the four sample omelette recipes (Simple / French / Cheese / Denver)
 * forming a parent-child DAG. Directions use `#<ingredient-uuid>` ingredient
 * references so the demo exercises the direction ingredient-refs feature.
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from './db/index.js';
import { recipeNodes } from './db/schema.js';
import { eq } from 'drizzle-orm';
import type { IngredientChange, DirectionChange } from '$lib/obj/RecipeNode.svelte';

// Stable ingredient/direction ids so edits in child nodes can target rows
// added by parent nodes within the same recipe chain.
const SIMPLE_INGREDIENT_IDS = {
	eggs: uuidv4(),
	butter: uuidv4(),
	salt: uuidv4(),
};
const SIMPLE_DIRECTION_IDS = {
	beatEggs: uuidv4(),
	meltButter: uuidv4(),
	cookEggs: uuidv4(),
	foldServe: uuidv4(),
};

const CHEESE_INGREDIENT_ID = uuidv4();

const DENVER_INGREDIENT_IDS = {
	ham: uuidv4(),
	pepper: uuidv4(),
	onion: uuidv4(),
};

const FRENCH_INGREDIENT_IDS = {
	chives: uuidv4(),
};

// Bouillabaisse — stable ingredient ids referenced by direction bodies.
const B_INGREDIENT_IDS = {
	fish: uuidv4(),
	shrimp: uuidv4(),
	mussels: uuidv4(),
	oil: uuidv4(),
	leek: uuidv4(),
	fennel: uuidv4(),
	onion: uuidv4(),
	garlic: uuidv4(),
	tomato: uuidv4(),
	saffron: uuidv4(),
	orange: uuidv4(),
	pastis: uuidv4(),
	stock: uuidv4(),
	parsley: uuidv4(),
	frozen: uuidv4(),
	potato: uuidv4(),
	baguette: uuidv4(),
	mayo: uuidv4(),
	flakes: uuidv4(),
	herbs: uuidv4(),
};

// Stable direction ids so child edits target the parent's rows.
const B_DIRECTION_IDS = {
	heatOil: uuidv4(),
	sweatAromatics: uuidv4(),
	stirTomato: uuidv4(),
	pourStock: uuidv4(),
	simmer: uuidv4(),
	addFish: uuidv4(),
	addMussels: uuidv4(),
	restServe: uuidv4(),
	makeRouille: uuidv4(),
};

function ingredientRemove(targetId: string, note: string | null): IngredientChange {
	return { id: uuidv4(), changeType: 'remove', targetId, note, body: null };
}

function directionRemove(targetId: string, note: string | null): DirectionChange {
	return { id: uuidv4(), changeType: 'remove', targetId, note, body: null };
}

function bouillabaisseIngredientChanges(): IngredientChange[] {
	return [
		ingredientAdd(B_INGREDIENT_IDS.fish, { name: 'Mixed Fish & Shellfish (lingcod, sea bream)', amount: 800, unit: 'g' }),
		ingredientAdd(B_INGREDIENT_IDS.shrimp, { name: 'Shrimp', amount: 200, unit: 'g' }),
		ingredientAdd(B_INGREDIENT_IDS.mussels, { name: 'Mussels', amount: 500, unit: 'g' }),
		ingredientAdd(B_INGREDIENT_IDS.oil, { name: 'Olive Oil', amount: 4, unit: 'tbsp' }),
		ingredientAdd(B_INGREDIENT_IDS.leek, { name: 'Leek', amount: 1, unit: '' }),
		ingredientAdd(B_INGREDIENT_IDS.fennel, { name: 'Fennel Bulb', amount: 1, unit: '' }),
		ingredientAdd(B_INGREDIENT_IDS.onion, { name: 'Onion', amount: 1, unit: '' }),
		ingredientAdd(B_INGREDIENT_IDS.garlic, { name: 'Garlic', amount: 4, unit: 'cloves' }),
		ingredientAdd(B_INGREDIENT_IDS.tomato, { name: 'Canned Tomatoes', amount: 400, unit: 'g' }),
		ingredientAdd(B_INGREDIENT_IDS.saffron, { name: 'Saffron', amount: 1, unit: 'pinch' }),
		ingredientAdd(B_INGREDIENT_IDS.orange, { name: 'Orange Peel', amount: 1, unit: 'strip' }),
		ingredientAdd(B_INGREDIENT_IDS.pastis, { name: 'Pastis', amount: 2, unit: 'tbsp' }),
		ingredientAdd(B_INGREDIENT_IDS.stock, { name: 'Fish Stock', amount: 1.5, unit: 'l' }),
		ingredientAdd(B_INGREDIENT_IDS.parsley, { name: 'Fresh Parsley', amount: 2, unit: 'tbsp' }),
	];
}

function bouillabaisseDirectionChanges(): DirectionChange[] {
	return [
		directionAdd(B_DIRECTION_IDS.heatOil, `Heat ${ref(B_INGREDIENT_IDS.oil)} in a large pot over medium heat.`),
		directionAdd(B_DIRECTION_IDS.sweatAromatics, `Sweat ${ref(B_INGREDIENT_IDS.leek)}, ${ref(B_INGREDIENT_IDS.fennel)}, ${ref(B_INGREDIENT_IDS.onion)}, and ${ref(B_INGREDIENT_IDS.garlic)} until soft, about 8 minutes.`),
		directionAdd(B_DIRECTION_IDS.stirTomato, `Stir in ${ref(B_INGREDIENT_IDS.tomato)}, ${ref(B_INGREDIENT_IDS.orange)}, and ${ref(B_INGREDIENT_IDS.saffron)}; cook 5 minutes.`),
		directionAdd(B_DIRECTION_IDS.pourStock, `Pour in ${ref(B_INGREDIENT_IDS.stock)} and ${ref(B_INGREDIENT_IDS.pastis)}; bring to a simmer.`),
		directionAdd(B_DIRECTION_IDS.simmer, 'Simmer uncovered for 20 minutes so the broth concentrates.'),
		directionAdd(B_DIRECTION_IDS.addFish, `Add ${ref(B_INGREDIENT_IDS.fish)} and ${ref(B_INGREDIENT_IDS.shrimp)}; cook 5 minutes.`),
		directionAdd(B_DIRECTION_IDS.addMussels, `Add ${ref(B_INGREDIENT_IDS.mussels)}; cover and steam until the shells open, 3-4 minutes.`),
		directionAdd(B_DIRECTION_IDS.restServe, `Rest off the heat for 5 minutes, then serve garnished with ${ref(B_INGREDIENT_IDS.parsley)}.`),
	];
}

/**
 * Insert the bouillabaisse tree: an imported root ("Auguste's Bouillabaisse")
 * with 5 descendant levels — Weeknight → with Rouille → {One-Pot, Spicy} →
 * Provençal → for Two. The fork at level 3 gives the graph and log views a
 * branch shape.
 */
async function seedBouillabaisse(ownerId: string): Promise<void> {
	const rootId = uuidv4();
	await db.insert(recipeNodes).values({
		id: rootId,
		parentId: null,
		ownerId,
		name: "Auguste's Bouillabaisse",
		source: 'marmiton.org',
		ingredientChanges: bouillabaisseIngredientChanges(),
		directionChanges: bouillabaisseDirectionChanges(),
	});

	// Weeknight — level 1: frozen seafood mix + potato, shorter simmer.
	const weeknightId = uuidv4();
	await db.insert(recipeNodes).values({
		id: weeknightId,
		parentId: rootId,
		ownerId,
		name: 'Weeknight Bouillabaisse',
		ingredientChanges: [
			ingredientAdd(B_INGREDIENT_IDS.frozen, { name: 'Frozen Seafood Mix', amount: 700, unit: 'g' }),
			ingredientAdd(B_INGREDIENT_IDS.potato, { name: 'Yukon Gold Potato', amount: 2, unit: '' }),
		],
		directionChanges: [
			directionEdit(
				B_DIRECTION_IDS.simmer,
				'Simmer uncovered for 15 minutes — the potato needs the head start.'
			),
			directionEdit(
				B_DIRECTION_IDS.addFish,
				`Add ${ref(B_INGREDIENT_IDS.frozen)} and the diced ${ref(B_INGREDIENT_IDS.potato)}; cook 8 minutes.`
			),
		],
	});

	// with Rouille — level 2: baguette + mayo rouille, serve over toast.
	const rouilleId = uuidv4();
	await db.insert(recipeNodes).values({
		id: rouilleId,
		parentId: weeknightId,
		ownerId,
		name: 'Bouillabaisse with Rouille',
		ingredientChanges: [
			ingredientAdd(B_INGREDIENT_IDS.baguette, { name: 'Baguette', amount: 1, unit: '' }),
			ingredientAdd(B_INGREDIENT_IDS.mayo, { name: 'Mayonnaise', amount: 3, unit: 'tbsp' }),
		],
		directionChanges: [
			directionAdd(
				B_DIRECTION_IDS.makeRouille,
				`Stir ${ref(B_INGREDIENT_IDS.mayo)} with a grated ${ref(B_INGREDIENT_IDS.garlic)} clove for a quick rouille.`
			),
			directionEdit(
				B_DIRECTION_IDS.restServe,
				`Rest off the heat for 5 minutes. Serve over toasted ${ref(B_INGREDIENT_IDS.baguette)} with a dollop of rouille and ${ref(B_INGREDIENT_IDS.parsley)} on top.`
			),
		],
	});

	// One-Pot — level 3, fork: remove the rouille, serve straight from the pot.
	await db.insert(recipeNodes).values({
		id: uuidv4(),
		parentId: rouilleId,
		ownerId,
		name: 'One-Pot Bouillabaisse',
		ingredientChanges: [ingredientRemove(B_INGREDIENT_IDS.mayo, 'Skip the rouille — fewer dishes')],
		directionChanges: [
			directionRemove(B_DIRECTION_IDS.makeRouille, null),
			directionEdit(
				B_DIRECTION_IDS.restServe,
				`Rest off the heat for 5 minutes, then serve straight from the pot with ${ref(B_INGREDIENT_IDS.parsley)} on top.`
			),
		],
	});

	// Spicy — level 3, main chain: red pepper flakes.
	const spicyId = uuidv4();
	await db.insert(recipeNodes).values({
		id: spicyId,
		parentId: rouilleId,
		ownerId,
		name: 'Spicy Bouillabaisse with Rouille',
		ingredientChanges: [
			ingredientAdd(B_INGREDIENT_IDS.flakes, { name: 'Red Pepper Flakes', amount: 1, unit: 'tsp' }),
		],
		directionChanges: [
			directionEdit(
				B_DIRECTION_IDS.stirTomato,
				`Stir in ${ref(B_INGREDIENT_IDS.tomato)}, ${ref(B_INGREDIENT_IDS.orange)}, ${ref(B_INGREDIENT_IDS.saffron)}, and ${ref(B_INGREDIENT_IDS.flakes)}; cook 5 minutes.`
			),
		],
	});

	// Provençal — level 4: herbes de Provence.
	const provencalId = uuidv4();
	await db.insert(recipeNodes).values({
		id: provencalId,
		parentId: spicyId,
		ownerId,
		name: 'Provençal Spicy Bouillabaisse',
		ingredientChanges: [
			ingredientAdd(B_INGREDIENT_IDS.herbs, { name: 'Herbes de Provence', amount: 1, unit: 'tsp' }),
		],
		directionChanges: [
			directionEdit(
				B_DIRECTION_IDS.pourStock,
				`Pour in ${ref(B_INGREDIENT_IDS.stock)} and ${ref(B_INGREDIENT_IDS.pastis)}; season with ${ref(B_INGREDIENT_IDS.herbs)} and bring to a simmer.`
			),
		],
	});

	// for Two — level 5: halve the fish and stock.
	await db.insert(recipeNodes).values({
		id: uuidv4(),
		parentId: provencalId,
		ownerId,
		name: 'Provençal Bouillabaisse for Two',
		ingredientChanges: [
			ingredientEdit(B_INGREDIENT_IDS.fish, { name: 'Mixed Fish & Shellfish (lingcod, sea bream)', amount: 400, unit: 'g' }),
			ingredientEdit(B_INGREDIENT_IDS.stock, { name: 'Fish Stock', amount: 750, unit: 'ml' }),
		],
		directionChanges: [],
	});
}

/** Format an ingredient reference for embedding in a direction body. */
function ref(ingredientId: string): string {
	return `#${ingredientId}`;
}

// ─── Change helpers ─────────────────────────────────────────────────────────

function ingredientAdd(
	id: string,
	ing: { name: string; amount: number; unit: string }
): IngredientChange {
	return {
		id,
		changeType: 'add',
		targetId: null,
		note: null,
		body: { id, name: ing.name, amount: ing.amount, unit: ing.unit },
	};
}

function ingredientEdit(
	targetId: string,
	ing: { name: string; amount: number; unit: string }
): IngredientChange {
	return {
		id: uuidv4(),
		changeType: 'edit',
		targetId,
		note: null,
		body: { id: targetId, name: ing.name, amount: ing.amount, unit: ing.unit },
	};
}

function directionAdd(id: string, body: string): DirectionChange {
	return { id, changeType: 'add', targetId: null, note: null, body: { id, body } };
}

function directionEdit(targetId: string, body: string): DirectionChange {
	return { id: uuidv4(), changeType: 'edit', targetId, note: null, body: { id: targetId, body } };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Insert the four sample recipes for `ownerId`, replacing any existing nodes. */
export async function seedForUser(ownerId: string): Promise<void> {
	// Delete all existing nodes for this user (cascade deletes children).
	await db.delete(recipeNodes).where(eq(recipeNodes.ownerId, ownerId));

	// Simple Omelette — root node (parentId = null).
	const simpleNodeId = uuidv4();
	await db.insert(recipeNodes).values({
		id: simpleNodeId,
		parentId: null,
		ownerId,
		name: 'Simple Omelette',
		ingredientChanges: [
			ingredientAdd(SIMPLE_INGREDIENT_IDS.eggs, { name: 'Eggs', amount: 3, unit: '' }),
			ingredientAdd(SIMPLE_INGREDIENT_IDS.butter, { name: 'Butter', amount: 1, unit: 'tbsp' }),
			ingredientAdd(SIMPLE_INGREDIENT_IDS.salt, { name: 'Salt', amount: 1, unit: 'pinch' }),
		],
		directionChanges: [
			directionAdd(
				SIMPLE_DIRECTION_IDS.beatEggs,
				`Beat ${ref(SIMPLE_INGREDIENT_IDS.eggs)} with ${ref(SIMPLE_INGREDIENT_IDS.salt)}.`
			),
			directionAdd(
				SIMPLE_DIRECTION_IDS.meltButter,
				`Melt ${ref(SIMPLE_INGREDIENT_IDS.butter)} in a pan over medium heat.`
			),
			directionAdd(
				SIMPLE_DIRECTION_IDS.cookEggs,
				`Pour in ${ref(SIMPLE_INGREDIENT_IDS.eggs)}, cook, stirring gently until set.`
			),
			directionAdd(SIMPLE_DIRECTION_IDS.foldServe, 'Fold in half and serve.'),
		],
	});

	// French Omelette — child of Simple. More butter, chives, low heat.
	await db.insert(recipeNodes).values({
		id: uuidv4(),
		parentId: simpleNodeId,
		ownerId,
		name: 'French Omelette',
		ingredientChanges: [
			ingredientEdit(SIMPLE_INGREDIENT_IDS.butter, { name: 'Butter', amount: 2, unit: 'tbsp' }),
			ingredientAdd(FRENCH_INGREDIENT_IDS.chives, { name: 'Chives', amount: 1, unit: 'tbsp' }),
		],
		directionChanges: [
			directionEdit(
				SIMPLE_DIRECTION_IDS.meltButter,
				`Melt ${ref(SIMPLE_INGREDIENT_IDS.butter)} over low heat until foamy.`
			),
			directionEdit(
				SIMPLE_DIRECTION_IDS.cookEggs,
				`Pour in ${ref(SIMPLE_INGREDIENT_IDS.eggs)} and stir constantly with the flat of a fork, keeping the curds moving. Do not brown.`
			),
			directionEdit(
				SIMPLE_DIRECTION_IDS.foldServe,
				`When surface is just set and still creamy, fold in thirds and slide onto a plate. Top with ${ref(FRENCH_INGREDIENT_IDS.chives)}.`
			),
		],
	});

	// Cheese Omelette — child of Simple.
	const cheeseNodeId = uuidv4();
	await db.insert(recipeNodes).values({
		id: cheeseNodeId,
		parentId: simpleNodeId,
		ownerId,
		name: 'Cheese Omelette',
		ingredientChanges: [
			ingredientAdd(CHEESE_INGREDIENT_ID, { name: 'Cheddar', amount: 50, unit: 'g' }),
		],
		directionChanges: [
			directionEdit(
				SIMPLE_DIRECTION_IDS.foldServe,
				`When almost set, sprinkle ${ref(CHEESE_INGREDIENT_ID)} over half, fold and serve.`
			),
		],
	});

	// Denver Omelette — child of Cheese Omelette. Ham, bell pepper, onion.
	await db.insert(recipeNodes).values({
		id: uuidv4(),
		parentId: cheeseNodeId,
		ownerId,
		name: 'Denver Omelette',
		ingredientChanges: [
			ingredientAdd(DENVER_INGREDIENT_IDS.ham, { name: 'Ham', amount: 50, unit: 'g' }),
			ingredientAdd(DENVER_INGREDIENT_IDS.pepper, { name: 'Bell pepper', amount: 1, unit: '' }),
			ingredientAdd(DENVER_INGREDIENT_IDS.onion, { name: 'Onion', amount: 0.5, unit: '' }),
		],
		directionChanges: [
			directionEdit(
				SIMPLE_DIRECTION_IDS.meltButter,
				`Sauté diced ${ref(DENVER_INGREDIENT_IDS.onion)} and ${ref(DENVER_INGREDIENT_IDS.pepper)} in ${ref(SIMPLE_INGREDIENT_IDS.butter)} until soft.`
			),
			directionEdit(
				SIMPLE_DIRECTION_IDS.cookEggs,
				`Add diced ${ref(DENVER_INGREDIENT_IDS.ham)}, then pour in beaten ${ref(SIMPLE_INGREDIENT_IDS.eggs)} and cook gently.`
			),
		],
	});

	// Bouillabaisse tree — imported root with 5 levels of forks/edits.
	await seedBouillabaisse(ownerId);
}
