import type { RecipeNode, IngredientChange, DirectionChange } from './obj/RecipeNode.svelte';
import type { Ingredient, Direction } from './obj/Recipe.svelte';

export interface RecipeSummary {
	id: string;
	name: string;
	parentId: string | null;
}

export interface RecipeTreeNode extends RecipeSummary {
	children: RecipeTreeNode[];
}

export interface RecipeDashboardItem {
	rootId: string;
	name: string;
	forkCount: number;
	lastEditedAt: Date;
	leafId: string;
}

export interface RecipeFavoriteItem {
	id: string;
	name: string;
	lastEditedAt: Date;
	authorName?: string | null;
	isOwner?: boolean;
	urlPath?: string;
}

export interface RecipeDetailView {
	recipe: {
		id: string;
		name: string;
		ingredients: Ingredient[];
		directions: Direction[];
	};
	currentNode: RecipeNode;
	history: RecipeNode[];
	parentChain: { id: string; name: string }[];
	descendantSubstitutes: {
		flat: unknown[];
		byRowId: Record<string, unknown[]>;
		byRowKind: Record<string, 'ingredient' | 'direction'>;
	};
	inheritedImages: {
		ingredients: Record<string, string[]>;
		directions: Record<string, string[]>;
	};
}

export interface RecipeStore {
	listTree(): Promise<RecipeTreeNode[]>;
	getDashboard(limit?: number): Promise<RecipeDashboardItem[]>;
	getFavorites(limit?: number): Promise<RecipeFavoriteItem[]>;
	getNode(nodeId: string): Promise<RecipeNode | null>;
	getRecipeView(nodeId: string): Promise<RecipeDetailView | null>;
	create(name: string): Promise<{ id: string }>;
	rename(rootNodeId: string, name: string): Promise<void>;
	fork(nodeId: string, name: string): Promise<{ id: string }>;
	remove(rootNodeId: string): Promise<void>;
	saveNode(
		nodeId: string,
		ingredientChanges: IngredientChange[],
		directionChanges: DirectionChange[]
	): Promise<void>;
	toggleFavorite(nodeId: string): Promise<boolean>;
	setPublic(nodeId: string, isPublic: boolean): Promise<void>;
}
