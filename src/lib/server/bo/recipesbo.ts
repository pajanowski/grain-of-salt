import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import {
	createRootRecipeNode,
	getRecipeNodesByRecipeId,
	appendRecipeNode
} from './recipenodesbo';
import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
import type { IngredientChange, DirectionChange } from '$lib/obj/RecipeNode.svelte';
import type { Recipe, Ingredient, Direction } from '$lib/obj/Recipe.svelte';

export async function saveNewRecipe(
	recipe: Recipe,
	ownerId: string,
	author?: string | null,
	source?: string | null,
): Promise<Recipe> {
	const ingredientChanges: IngredientChange[] = recipe.ingredients.map((ing: Ingredient) => ({
		changeType: 'add' as const,
		targetId: null,
		note: null,
		id: ing.id,
		body: { ...ing },
	}));
	const directionChanges: DirectionChange[] = recipe.directions.map((dir: Direction) => ({
		changeType: 'add' as const,
		targetId: null,
		note: null,
		id: dir.id,
		body: { ...dir },
	}));

	recipe.id = '';
	const root = await createRootRecipeNode(
		recipe.name,
		ownerId,
		author,
		source,
		ingredientChanges,
		directionChanges,
	);
	recipe.id = root.id;
	return recipe;
}

/**
 * Fork a recipe: append a new node to the chain rooted at `fromLeafNodeId`.
 *
 * Per ADR 0002, "fork" means chain extension: a new node is appended to
 * the existing chain with `parentId = fromLeafNodeId` and empty change
 * arrays. The new node's materialized state is identical to the source's
 * until the user adds their own changes. Ownership is propagated from the
 * parent inside `appendRecipeNode`; the route handler is responsible for
 * having verified the caller can see the source chain.
 *
 * The verb "fork" is retained in the UI for familiarity even though the
 * underlying semantics is closer to a git branch (new commit on the same
 * chain) than to a separate recipe.
 */
export async function forkRecipe(
	fromLeafNodeId: string,
	newName: string,
	author?: string | null,
): Promise<RecipeNode> {
	return await appendRecipeNode(fromLeafNodeId, newName, [], [], author);
}

/**
 * Delete a recipe by deleting its root node. Refuses to delete a recipe
 * owned by a different user.
 *
 * The ON DELETE CASCADE on recipe_nodes.parent_id removes the rest of the
 * chain automatically.
 */
export async function deleteRecipe(rootNodeId: string, ownerId: string) {
	await assertOwnership(rootNodeId, ownerId);
	await db.delete(recipeNodes).where(eq(recipeNodes.id, rootNodeId));
}

/**
 * Update the name on every node in the recipe's history.
 *
 * Throws if the recipe isn't owned by `ownerId`.
 */
export async function renameRecipe(
	rootNodeId: string,
	ownerId: string,
	newName: string,
): Promise<void> {
	await assertOwnership(rootNodeId, ownerId);

	// Walk the chain and update name on every node.
	const nodes = await getRecipeNodesByRecipeId(rootNodeId);
	await Promise.all(
		nodes.map((node) =>
			db
				.update(recipeNodes)
				.set({ name: newName })
				.where(and(eq(recipeNodes.id, node.id), eq(recipeNodes.ownerId, ownerId)))
		)
	);
}

/**
 * Verify that the given root node exists and belongs to `ownerId`. Throws
 * otherwise. Used as a guard at every recipe-mutating API entrypoint.
 */
async function assertOwnership(rootNodeId: string, ownerId: string): Promise<void> {
	const rows = await db
		.select({ ownerId: recipeNodes.ownerId })
		.from(recipeNodes)
		.where(and(eq(recipeNodes.id, rootNodeId), eq(recipeNodes.ownerId, ownerId)))
		.limit(1);
	if (rows.length === 0) {
		throw new Error('Recipe not found');
	}
}
