import type { RequestHandler } from './$types';
import { NewRecipe, type Recipe } from '$lib/obj/Recipe.svelte';
import { saveNewRecipe } from '$lib/server/bo/recipesbo';
import { DEMO_USER_ID } from '$lib/server/db/schema';

/**
 * Resolve the request's effective owner:
 *  - Authenticated Supabase user -> their own id.
 *  - Guest cookie only -> DEMO_USER_ID. Guests can save new demo recipes,
 *    but they will be owned by the demo user. (Demo tree is shared across
 *    all guests — see the trade-off note in `+layout.server.ts`.)
 *
 * Returns null if neither is set; the caller should reject in that case.
 */
function resolveOwnerId(
	locals: App.Locals,
	cookies: { get: (name: string) => string | undefined }
): string | null {
	if (locals.user?.id) return locals.user.id;
	if (cookies.get('guest') === '1') return DEMO_USER_ID;
	return null;
}

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	const ownerId = resolveOwnerId(locals, cookies);
	if (!ownerId) {
		return new Response('Sign in or continue as guest first', { status: 401 });
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
