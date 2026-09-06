import type { RequestHandler } from './$types';
import { NewRecipe } from '$lib/obj/Recipe.svelte';
import { saveNewRecipe } from '$lib/server/bo/recipesbo';

export const POST: RequestHandler = async ({ request, locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) {
		return new Response('Sign in first', { status: 401 });
	}
	const data = await request.formData();
	const recipeName = data.get('recipeName') as string;
	// TODO: reject empty/whitespace-only names with a 400. Currently any
	//       string (including '') creates a root node, which renders as a
	//       link with no accessible text. See "submitting an empty name"
	//       in tests/e2e/recipe-create.e2e.ts.
	const newRecipe = NewRecipe(recipeName);
	const ret = await saveNewRecipe(newRecipe, ownerId);
	return new Response(JSON.stringify(ret));
};
