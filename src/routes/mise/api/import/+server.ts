import type { RequestHandler } from './$types';
import { NewRecipe } from '$lib/obj/Recipe.svelte';
import { saveNewRecipe } from '$lib/server/bo/recipesbo';
import {
	parseRecipeFromHtml,
	parseRecipeFromUrl,
	ImportError
} from '$lib/server/recipe_parser';

export const POST: RequestHandler = async ({ request, locals }) => {
	const ownerId = locals.user?.id;
	if (!ownerId) {
		return new Response('Sign in first', { status: 401 });
	}
	const body = await request.json();
	const url = body.url as string;
	if (!url?.trim()) {
		return new Response('URL is required', { status: 400 });
	}

	let parsed;
	try {
		if (typeof body.html === 'string' && body.html.trim()) {
			// Client fetched the URL — we just need to parse it
			parsed = parseRecipeFromHtml(body.html, url);
		} else {
			// Fallback: server-side fetch (for browsers that can't fetch cross-origin)
			parsed = await parseRecipeFromUrl(url);
		}
	} catch (e) {
		if (e instanceof ImportError) {
			return new Response(e.message, { status: e.status });
		}
		return new Response(String(e), { status: 422 });
	}

	const recipe = NewRecipe(
		parsed.name,
		undefined,
		parsed.ingredients,
		parsed.directions
	);
	const saved = await saveNewRecipe(recipe, ownerId, parsed.author, parsed.source);

	return new Response(JSON.stringify({ recipe: saved }), {
		status: 201,
		headers: { 'Content-Type': 'application/json' }
	});
};
