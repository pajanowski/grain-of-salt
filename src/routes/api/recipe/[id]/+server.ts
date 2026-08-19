import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { deleteRecipe, renameRecipe } from '$lib/server/bo/recipesbo';
import { db } from '$lib/server/db';
import { recipeNodes } from '$lib/server/db/schema';

/**
 * Resolve a node id (the URL slug) to the recipeId it belongs to.
 * Returns null if the node doesn't exist.
 */
async function nodeIdToRecipeId(nodeId: string): Promise<string | null> {
  const rows = await db
    .select({ recipeId: recipeNodes.recipeId })
    .from(recipeNodes)
    .where(eq(recipeNodes.id, nodeId))
    .limit(1);
  return rows[0]?.recipeId ?? null;
}

export const DELETE: RequestHandler = async ({ params }) => {
  const recipeId = await nodeIdToRecipeId(params.id);

  if (!recipeId) {
    return new Response('Recipe not found', { status: 404 });
  }

  try {
    await deleteRecipe(recipeId);
    return new Response(null, { status: 200 });
  } catch (e) {
    return new Response((e as Error).message, {
      status: 500
    });
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const recipeId = await nodeIdToRecipeId(params.id);
  if (!recipeId) {
    return new Response('Recipe not found', { status: 404 });
  }

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    return new Response('Name is required', { status: 400 });
  }

  try {
    await renameRecipe(recipeId, body.name);
    return new Response(JSON.stringify({ name: body.name.trim() }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
};
