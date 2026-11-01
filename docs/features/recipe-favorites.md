# Recipe Favorites

A user can mark any recipe node—whether owned by themselves or shared publicly by another user—as a **favorite**. A favorited recipe shows an interactive amber star button in the header across all views, and favorited recipes are aggregated on the home screen (`/mise`) dashboard with author attribution badges for recipes authored by others.

## Behaviour

- **Per node, decoupled storage.** Favorites are stored in a dedicated junction table (`user_recipe_favorites`) with composite primary key `(user_id, recipe_node_id)`. Decoupling from `recipe_nodes` prevents write contention and permits multi-user bookmarking.
- **Interactive Header Star.** An interactive button with `data-testid="recipe-favorite-star"` appears in the recipe header `<h1>` across both private (`/mise/recipes/[slug]`) and public (`/recipe/[recipeNodeId]`) recipe views.
- **Optimistic UI Feedback.** Toggling the star instantly transitions between inactive outline and active gold fill (`fill-amber-400 stroke-amber-500`).
- **Dashboard Feed & Ownership Routing.** The `/mise` home dashboard displays favorited recipes above recent recipes. Clicking an owned favorite navigates to the editable workspace (`/mise/recipes/[slug]`), while clicking an external favorite navigates to `/recipe/[recipeNodeId]` with an author attribution badge (e.g., `by Chef Alice`).
- **Guest Auth Conversion.** Unauthenticated visitors clicking the favorite button on a public recipe are redirected to `/auth?next=/recipe/[recipeNodeId]` to prompt sign-in with intent preservation.
- **Privacy Boundaries.** Users cannot favorite private recipes owned by other users; server endpoints reject such requests with `403 Forbidden`.

## Data Model

```sql
-- Migration: supabase/migrations/20261101000000_user_recipe_favorites.sql
CREATE TABLE public.user_recipe_favorites (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipe_node_id UUID NOT NULL REFERENCES public.recipe_nodes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, recipe_node_id)
);

CREATE INDEX idx_user_recipe_favorites_user_created 
    ON public.user_recipe_favorites (user_id, created_at DESC, recipe_node_id);

CREATE INDEX idx_user_recipe_favorites_recipe_node 
    ON public.user_recipe_favorites (recipe_node_id);

ALTER TABLE public.user_recipe_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
    ON public.user_recipe_favorites FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites on owned or public recipes"
    ON public.user_recipe_favorites FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND EXISTS (
            SELECT 1 FROM public.recipe_nodes rn
            WHERE rn.id = recipe_node_id AND (rn.owner_id = auth.uid() OR rn.is_public = true)
        )
    );

CREATE POLICY "Users can delete own favorites"
    ON public.user_recipe_favorites FOR DELETE
    USING (auth.uid() = user_id);
```

## API

### `PATCH /mise/api/recipe-node/[nodeId]/favorite`

- **Authentication:** Required (session cookie or mock session in single-user dev mode).
- **Permissions:** Allowed if target node is owned by caller OR `is_public = true`. Returns `403 Forbidden` if target node is private and owned by another user.
- **Response:** `200 OK` with `{ isFavorite: boolean }`.

## Files

### Added
- `supabase/migrations/20261101000000_user_recipe_favorites.sql`
- `tests/e2e/recipe-favorites-multi-user.e2e.ts`

### Modified
- `src/lib/server/db/schema.ts`
- `src/lib/server/bo/recipenodesbo.ts`
- `src/lib/server/bo/recipenodesbo.test.ts`
- `src/routes/mise/api/recipe-node/[nodeId]/favorite/+server.ts`
- `src/routes/recipe/[recipeNodeId]/+page.server.ts`
- `src/routes/recipe/[recipeNodeId]/+page.svelte`
- `src/lib/component/Recipe.svelte`
- `src/lib/component/PublicRecipe.svelte`
- `src/lib/component/RecipeDashboard.svelte`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/helpers/page-utils.ts`
- `tests/e2e/recipe-favorite-toggle.e2e.ts`
