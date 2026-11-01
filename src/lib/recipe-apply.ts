import type { Ingredient, Direction } from './obj/Recipe.svelte';
import type { RecipeNode, IngredientChange, DirectionChange } from './obj/RecipeNode.svelte';

export interface RecipeState {
	ingredients: Ingredient[];
	directions: Direction[];
}

/**
 * Pure function: replay an ordered list of nodes against an empty state.
 */
export function applyNodes(nodes: RecipeNode[]): RecipeState {
	const ingredients = new Map<string, Ingredient>();
	const directions = new Map<string, Direction>();
	const ingredientNotes = new Map<string, string | null>();
	const directionNotes = new Map<string, string | null>();
	const ingredientImages = new Map<string, string[]>();
	const directionImages = new Map<string, string[]>();

	for (const node of nodes) {
		for (const change of node.ingredientChanges) {
			applyIngredientChange(ingredients, ingredientNotes, ingredientImages, change);
		}
		for (const change of node.directionChanges) {
			applyDirectionChange(directions, directionNotes, directionImages, change);
		}
	}

	const ingredientList = Array.from(ingredients.values()).map((ing) => ({
		...ing,
		note: ingredientNotes.get(ing.id) ?? null,
		imagePaths: ingredientImages.get(ing.id) ?? null
	}));
	const directionList = Array.from(directions.values()).map((dir) => ({
		...dir,
		note: directionNotes.get(dir.id) ?? null,
		imagePaths: directionImages.get(dir.id) ?? null
	}));

	return {
		ingredients: ingredientList,
		directions: directionList
	};
}

function applyImagePaths<T extends { id: string; imagePaths?: string[] | null }>(
	state: Map<string, T>,
	images: Map<string, string[]>,
	body: T | null | undefined
): void {
	if (!body || !('imagePaths' in body)) return;
	if (body.imagePaths === null || body.imagePaths === undefined) return;
	images.set(body.id, body.imagePaths);
}

function applyIngredientChange(
	state: Map<string, Ingredient>,
	notes: Map<string, string | null>,
	images: Map<string, string[]>,
	change: IngredientChange
): void {
	switch (change.changeType) {
		case 'add': {
			if (!change.body) return;
			const id = change.body.id || change.id;
			if (change.targetId !== null) {
				if (state.has(id)) {
					const existing = state.get(id)!;
					state.delete(id);
					state.set(id, { ...existing, id });
				}
				return;
			}
			if (state.has(id)) state.delete(id);
			if (notes.has(id)) notes.delete(id);
			state.set(id, { ...change.body, id });
			notes.set(id, change.note ?? null);
			applyImagePaths(state, images, change.body);
			return;
		}
		case 'edit':
		case 'substitute': {
			if (!change.targetId || !change.body) return;
			if (state.has(change.targetId)) {
				state.set(change.targetId, { ...change.body, id: change.targetId });
				notes.set(change.targetId, change.note ?? null);
				applyImagePaths(state, images, change.body);
			}
			return;
		}
		case 'remove': {
			if (change.targetId) {
				state.delete(change.targetId);
				notes.delete(change.targetId);
				images.delete(change.targetId);
			}
			return;
		}
	}
}

function applyDirectionChange(
	state: Map<string, Direction>,
	notes: Map<string, string | null>,
	images: Map<string, string[]>,
	change: DirectionChange
): void {
	switch (change.changeType) {
		case 'add': {
			if (!change.body) return;
			const id = change.body.id || change.id;
			if (change.targetId !== null) {
				if (state.has(id)) {
					const existing = state.get(id)!;
					state.delete(id);
					state.set(id, { ...existing, id });
				}
				return;
			}
			if (state.has(id)) state.delete(id);
			if (notes.has(id)) notes.delete(id);
			state.set(id, { ...change.body, id });
			notes.set(id, change.note ?? null);
			applyImagePaths(state, images, change.body);
			return;
		}
		case 'edit':
		case 'substitute': {
			if (!change.targetId || !change.body) return;
			if (state.has(change.targetId)) {
				state.set(change.targetId, { ...change.body, id: change.targetId });
				notes.set(change.targetId, change.note ?? null);
				applyImagePaths(state, images, change.body);
			}
			return;
		}
		case 'remove': {
			if (change.targetId) {
				state.delete(change.targetId);
				notes.delete(change.targetId);
				images.delete(change.targetId);
			}
			return;
		}
	}
}
