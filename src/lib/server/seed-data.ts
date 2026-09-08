/**
 * Static seed data for recipe nodes. Shared between the CLI seed script
 * (`scripts/seed.ts`) and the in-app seed API (`/mise/api/seed`).
 *
 * Exports `seedForUser(ownerId)` which wipes the user's existing nodes and
 * inserts the four sample omelette recipes (Simple / French / Cheese / Denver)
 * forming a parent-child DAG.
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
		label: 'initial recipe',
		ingredientChanges: [
			ingredientAdd(SIMPLE_INGREDIENT_IDS.eggs, { name: 'Eggs', amount: 3, unit: '' }),
			ingredientAdd(SIMPLE_INGREDIENT_IDS.butter, { name: 'Butter', amount: 1, unit: 'tbsp' }),
			ingredientAdd(SIMPLE_INGREDIENT_IDS.salt, { name: 'Salt', amount: 1, unit: 'pinch' }),
		],
		directionChanges: [
			directionAdd(SIMPLE_DIRECTION_IDS.beatEggs, 'Beat eggs with salt.'),
			directionAdd(SIMPLE_DIRECTION_IDS.meltButter, 'Melt butter in a pan over medium heat.'),
			directionAdd(SIMPLE_DIRECTION_IDS.cookEggs, 'Pour in eggs, cook, stirring gently until set.'),
			directionAdd(SIMPLE_DIRECTION_IDS.foldServe, 'Fold in half and serve.'),
		],
	});

	// French Omelette — child of Simple. More butter, chives, low heat.
	await db.insert(recipeNodes).values({
		id: uuidv4(),
		parentId: simpleNodeId,
		ownerId,
		name: 'French Omelette',
		label: 'bump butter, add chives; cook low and slow, no browning',
		ingredientChanges: [
			ingredientEdit(SIMPLE_INGREDIENT_IDS.butter, { name: 'Butter', amount: 2, unit: 'tbsp' }),
			ingredientAdd(FRENCH_INGREDIENT_IDS.chives, { name: 'Chives', amount: 1, unit: 'tbsp' }),
		],
		directionChanges: [
			directionEdit(SIMPLE_DIRECTION_IDS.meltButter, 'Melt butter over low heat until foamy.'),
			directionEdit(
				SIMPLE_DIRECTION_IDS.cookEggs,
				'Pour in eggs and stir constantly with the flat of a fork, keeping the curds moving. Do not brown.'
			),
			directionEdit(
				SIMPLE_DIRECTION_IDS.foldServe,
				'When surface is just set and still creamy, fold in thirds and slide onto a plate.'
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
		label: 'add cheese, fold with cheese inside',
		ingredientChanges: [
			ingredientAdd(CHEESE_INGREDIENT_ID, { name: 'Cheddar', amount: 50, unit: 'g' }),
		],
		directionChanges: [
			directionEdit(
				SIMPLE_DIRECTION_IDS.foldServe,
				'When almost set, sprinkle cheese over half, fold and serve.'
			),
		],
	});

	// Denver Omelette — child of Cheese Omelette. Ham, bell pepper, onion.
	await db.insert(recipeNodes).values({
		id: uuidv4(),
		parentId: cheeseNodeId,
		ownerId,
		name: 'Denver Omelette',
		label: 'add diced ham, bell pepper, and onion',
		ingredientChanges: [
			ingredientAdd(DENVER_INGREDIENT_IDS.ham, { name: 'Ham', amount: 50, unit: 'g' }),
			ingredientAdd(DENVER_INGREDIENT_IDS.pepper, { name: 'Bell pepper', amount: 1, unit: '' }),
			ingredientAdd(DENVER_INGREDIENT_IDS.onion, { name: 'Onion', amount: 0.5, unit: '' }),
		],
		directionChanges: [
			directionEdit(
				SIMPLE_DIRECTION_IDS.meltButter,
				'Sauté diced onion and bell pepper in butter until soft.'
			),
			directionEdit(
				SIMPLE_DIRECTION_IDS.cookEggs,
				'Add diced ham, then pour in beaten eggs and cook gently.'
			),
		],
	});
}
