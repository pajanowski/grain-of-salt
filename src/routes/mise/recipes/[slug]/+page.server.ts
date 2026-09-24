import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getRecipeNodesByRecipeIdV2,
	applyNodes,
	findDescendantSubstitutes
} from '$lib/server/bo/recipenodesbo';
import type { DescendantSubstitutes } from '$lib/server/bo/recipenodesbo';
import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';

/**
 * The page URL is `/recipes/[slug]`, where `slug` is any recipe node id.
 *
 * We walk up the parentId chain to the root, then replay all nodes forward
 * (root → ... → current) to build the materialized recipe state. The
 * `parentChain` shows ancestor recipes for breadcrumb navigation.
 *
 * `descendantSubstitutes` is the list of substitute changes authored by
 * any later node in the chain (a fork-off that swaps one of this
 * node's rows for a different value). Rendered as a per-row "Subs"
 * chip on the leaf, plus a slide-out sidebar listing each entry.
 */
export const load: PageServerLoad = async ({ depends, params, locals }) => {
	depends('app:recipe');
	const recipeNodeId = params.slug;

	// Fetch the chain from current node back to root.
	const chainBackwards = await getRecipeNodesByRecipeIdV2(recipeNodeId);

	// Reverse so we have root → ... → current (oldest first, needed for replay).
	const history = [...chainBackwards].reverse();

	if (history.length === 0) {
		throw error(404, 'Recipe not found');
	}

	// The root is the first element after reversing.
	const root = history[0];
	// The current node is the last element.
	const current = history[history.length - 1];

	// Materialize the full recipe state by replaying all nodes.
	const state = applyNodes(history);

	// `inheritedImages` is computed from the same materialized state.
	// Edit forms surface whatever's currently displayed on each row
	// (full chain replay, including the leaf's own change), and the
	// "Inherit images from parent" button captures that set onto the
	// change record. For a fresh fork with no edits, the ancestor's
	// images surface naturally; for a leaf with existing edits, the
	// leaf's staged set surfaces — both consistent with the user-
	// visible row.
	const inheritedState = state;

	// Build the parent breadcrumb chain: ancestor recipes (not including self).
	// Skip the first entry (root) — we don't include the recipe itself in the chain.
	// Then skip the last entry (current) — that's the page we're on.
	const parentChain = history
		.slice(1) // drop root
		.slice(0, -1) // drop current
		.map((node: RecipeNode) => ({ id: node.id, name: node.name }));

	// Find every substitute authored by a descendant of the current
	// node. Only meaningful when the user is signed in — unauthenticated
	// browsers see an empty list and the panel renders nothing.
	const { session, user } = await locals.safeGetSession();
	const ownerId = user?.id ?? null;
	void session; // referenced for consistency with sibling loaders
	const descendantSubstitutes: DescendantSubstitutes = ownerId
		? await findDescendantSubstitutes(current.id, ownerId)
		: { flat: [], byRowId: {}, byRowKind: {} };

	return {
		recipe: {
			// Recipe identity is the root node, not the node currently being
			// viewed/edited. save/rename APIs walk the chain forward from
			// this id via `parentId`, so it must be the root.
			id: root.id,
			name: current.name,
			ingredients: state.ingredients,
			directions: state.directions
		},
		// Editing happens on the leaf. The client uses its full change arrays
		// to distinguish Case A (leaf owns a change referencing this row's
		// add-id) from Case B (inherited from ancestor). See ADR 0001.
		currentNode: { ...current, author: current.author, source: current.source },
		history, // full node chain for the history UI
		parentChain,
		descendantSubstitutes,
		/**
		 * Per-row imagePaths as materialized by the chain. Edit forms
		 * consume this to:
		 *   - decide whether to render the "Inherit images from parent"
		 *     button (visible only when the inherited set is non-empty)
		 *   - populate the local preview when the user clicks the
		 *     button (explicit copy of the inherited set onto the
		 *     change record)
		 */
		inheritedImages: {
			ingredients: Object.fromEntries(
				inheritedState.ingredients
					.filter((i) => i.imagePaths && i.imagePaths.length > 0)
					.map((i) => [i.id, i.imagePaths as string[]])
			),
			directions: Object.fromEntries(
				inheritedState.directions
					.filter((d) => d.imagePaths && d.imagePaths.length > 0)
					.map((d) => [d.id, d.imagePaths as string[]])
			)
		}
	};
};
