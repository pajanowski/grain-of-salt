import type { RequestHandler } from './$types';
import { forkRecipe } from '$lib/server/bo/recipesbo';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Fork a recipe. The URL param `id` is the root node id of the recipe being
 * forked. A new recipe is created whose root node's parentNodeId points back
 * to this root — establishing the "forked from" relationship.
 *
 * POST /api/recipe/[id]/fork
 * Body: { "name": "New Recipe Name" }
 * Returns: the new Recipe (with its root node id as id)
 */
export const POST: RequestHandler = async ({ params, request }) => {
  // Verify the source recipe exists.
  const rows = await db
    .select({ id: recipeNodes.id })
    .from(recipeNodes)
    .where(eq(recipeNodes.id, params.id))
    .limit(1);

  if (rows.length === 0) {
    return new Response('Recipe not found', { status: 404 });
  }

  const sourceRootNodeId = rows[0].id;

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    return new Response('name is required', { status: 400 });
  }

  try {
    const newRecipe = await forkRecipe(sourceRootNodeId, body.name.trim());
    return new Response(JSON.stringify(newRecipe), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
};
