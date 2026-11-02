# Plan: Multi-User Recipe Favorites

> Status: **Draft, ready for implementation.**
> Enables users to favorite both their own recipes and public recipes authored by other users, backed by an efficient, highly scalable junction table model with multi-user test coverage.

---

## 1. Overview & Objectives

Marking recipes as favorites is currently restricted to a single boolean flag (`is_favorite`) on `recipe_nodes`. In a multi-user environment where users discover and bookmark recipes created by other cooks, this model causes write contention, violates row ownership boundaries, and prevents cross-user discovery.

This plan details the implementation of a dedicated junction table (`user_recipe_favorites`), uniform header UI placement across all recipe views, author attribution on the dashboard, and end-to-end multi-user test validation.

### Key Goals
- **High Scalability & Minimal Latency:** Utilize a composite-indexed junction table (`user_id`, `recipe_node_id`) ensuring $O(1)$ favorite lookups and index-only scans for paginated dashboard retrieval.
- **Consistent UX:** Single-click favorite star icon in the header next to the recipe title across private (`/mise/recipes/[slug]`) and public (`/recipe/[recipeNodeId]`) views.
- **Functional Split by Ownership:** Cleanly differentiate behavior between owned recipes (editable, linked to `/mise/recipes/[slug]`) and external recipes (read-only, linked to `/recipe/[recipeNodeId]` with author attribution).
- **Comprehensive Multi-User Verification:** Validate permission boundaries, data isolation, and auth conversion flows across multiple distinct browser sessions in Playwright.

---

## 2. Architecture & Design Decisions

| # | Topic | Decision | Rationale |
|---|---|---|---|
| **D1** | **Storage Model** | Single normalized junction table `public.user_recipe_favorites` with composite primary key `(user_id, recipe_node_id)`. | Provides optimal write throughput, zero write contention on `recipe_nodes`, and minimal storage (~64 bytes/row). |
| **D2** | **Indexing Strategy** | Compound index on `(user_id, created_at DESC, recipe_node_id)` and reverse FK index on `(recipe_node_id)`. | Powers index-only scans for user favorite feeds and optimizes cascading deletions. |
| **D3** | **Security & RLS** | Row-Level Security policies restricting insert/delete strictly to `auth.uid() = user_id`, allowing inserts only for owned or public (`is_public = true`) recipes. | Enforces data privacy and authorization directly at the database engine level. |
| **D4** | **Button Placement** | Interactive star toggle icon in the recipe header `<h1>` next to the title across all recipe views. | Provides an intuitive, muscle-memory location for saving recipes regardless of view context. |
| **D5** | **Dashboard Display** | Favorites section on `/mise` displays both owned and external favorites; external cards feature an author attribution badge (`by Chef Name`). | Unifies personal bookmarking while clearly distinguishing original authorship and navigation targets. |
| **D6** | **Unauthenticated Guests** | Clicking the star button on public recipes redirects to `/auth?next=...` to prompt sign-in with preserved favorite intent. | Maximizes conversion and allows visitors to easily save recipes to their library. |

---

## 3. Tasks and Subtasks

### Task 1: Database Migration & Schema Definition
Create the database migration and Drizzle ORM definitions for the `user_recipe_favorites` junction table with compound indexing, cascading foreign keys, RLS policies, and backfill.

- [ ] **1.1 Database Migration File**
  - Create `supabase/migrations/20261101000000_user_recipe_favorites.sql`.
  - Define `public.user_recipe_favorites` table:
    ```sql
    CREATE TABLE public.user_recipe_favorites (
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        recipe_node_id UUID NOT NULL REFERENCES public.recipe_nodes(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, recipe_node_id)
    );
    ```
  - Create indexes:
    - `CREATE INDEX idx_user_recipe_favorites_user_created ON public.user_recipe_favorites (user_id, created_at DESC, recipe_node_id);`
    - `CREATE INDEX idx_user_recipe_favorites_recipe_node ON public.user_recipe_favorites (recipe_node_id);`
- [ ] **1.2 Row-Level Security (RLS) Policies**
  - Enable RLS on `public.user_recipe_favorites`.
  - Add `SELECT` policy: `auth.uid() = user_id`.
  - Add `INSERT` policy: `auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.recipe_nodes rn WHERE rn.id = recipe_node_id AND (rn.owner_id = auth.uid() OR rn.is_public = true))`.
  - Add `DELETE` policy: `auth.uid() = user_id`.
- [ ] **1.3 Data Backfill**
  - Backfill existing `is_favorite = true` records from `recipe_nodes`:
    ```sql
    INSERT INTO public.user_recipe_favorites (user_id, recipe_node_id, created_at)
    SELECT owner_id, id, updated_at
    FROM public.recipe_nodes
    WHERE is_favorite = true
    ON CONFLICT DO NOTHING;
    ```
- [ ] **1.4 Drizzle ORM Schema Updates**
  - Update `src/lib/server/db/schema.ts` to export `userRecipeFavorites` table definition, relations, and TypeScript types (`SelectUserRecipeFavorite`, `InsertUserRecipeFavorite`).

---

### Task 2: Server Business Logic & Query Layer
Implement business operations in `src/lib/server/bo/recipenodesbo.ts` for toggling, batch querying, and paginated retrieval of favorited recipes.

- [ ] **2.1 Toggle Favorite Operation (`toggleRecipeFavorite`)**
  - Implement `toggleRecipeFavorite(userId: string, recipeNodeId: string): Promise<{ isFavorite: boolean }>`.
  - Validate that the target recipe exists and is either owned by `userId` or has `is_public = true` (throw 403/404 if private and not owned).
  - Perform atomic insert or delete in `user_recipe_favorites`.
- [ ] **2.2 Single & Batch Favorite Checks**
  - Implement `isRecipeFavorited(userId: string, recipeNodeId: string): Promise<boolean>`.
  - Implement `getFavoritesBatch(userId: string, recipeNodeIds: string[]): Promise<Record<string, boolean>>` using `IN (...)` queries to prevent N+1 queries when rendering lists.
- [ ] **2.3 Multi-User Favorites Aggregation (`getRecipeFavorites`)**
  - Update `getRecipeFavorites(userId: string, limit?: number, offset?: number)`:
    - Query `user_recipe_favorites` joined with `recipe_nodes` and `profiles` (for author metadata).
    - Return structured favorite objects including `id`, `name`, `authorName`, `isOwner`, `lastEditedAt`, `urlPath` (`/mise/recipes/[slug]` for owned, `/recipe/[recipeNodeId]` for external).
- [ ] **2.4 Unit Test Suite**
  - Add unit tests in `src/lib/server/bo/recipenodesbo.test.ts`:
    - Toggling owned recipes (favorite and unfavorite).
    - Toggling foreign public recipes.
    - Rejecting favorite attempts on foreign private recipes.
    - Verifying batch favorite resolution and query isolation between distinct user IDs.

---

### Task 3: API Endpoints
Update and standardize HTTP endpoints for toggling recipe favorites across owned and foreign public recipes.

- [ ] **3.1 Favorite Toggle Endpoint (`PATCH /mise/api/recipe-node/[nodeId]/favorite`)**
  - Update `src/routes/mise/api/recipe-node/[nodeId]/favorite/+server.ts`:
    - Enforce authentication via `requireUser(event)`.
    - Delegate toggle action to `toggleRecipeFavorite(user.id, params.nodeId)`.
    - Return JSON `{ isFavorite: boolean }` with appropriate HTTP status codes (200 OK, 403 Forbidden for private foreign nodes, 404 for missing nodes).

---

### Task 4: UI & Recipe View Integration
Implement the uniform favorite star toggle across private workspace recipes, public community recipes, and context menus.

- [ ] **4.1 Private Workspace Recipe View (`src/lib/component/Recipe.svelte`)**
  - Add interactive star toggle button in the recipe header `<h1>` next to the title (`data-testid="recipe-favorite-star"`).
  - Implement optimistic toggle with instant icon fill/unfill and background `PATCH` request.
  - Retain "Favorite" / "Unfavorite" toggle item in the recipe context menu for parity.
- [ ] **4.2 Public / Shared Recipe View (`src/lib/component/PublicRecipe.svelte` & `src/routes/recipe/[recipeNodeId]/`)**
  - Add matching interactive star toggle button in the public recipe header `<h1>`.
  - If user is signed in: toggle favorite status optimistically via API.
  - If user is unauthenticated: redirect to `/auth?next=/recipe/[recipeNodeId]` with toast or prompt to save recipe.
  - Load initial favorite status for authenticated viewers via page server load.

---

### Task 5: Dashboard Favorites Integration
Update the `/mise` home dashboard to display and differentiate owned vs. external favorited recipes.

- [ ] **5.1 Server Loader Updates (`src/routes/mise/+page.server.ts`)**
  - Load favorited recipes via updated `getRecipeFavorites(user.id)` including author profile metadata.
- [ ] **5.2 Dashboard Favorites Component (`src/lib/component/RecipeDashboard.svelte`)**
  - Render favorite cards under the **Favorites** section.
  - Display author attribution badge (`by Author Name`) on cards for recipes authored by other users.
  - Route card clicks:
    - Owned recipes $\rightarrow$ `/mise/recipes/[slug]` (editable workspace).
    - External recipes $\rightarrow$ `/recipe/[recipeNodeId]` (public viewer).
  - Show empty state guidance when no recipes are favorited.

---

### Task 6: Multi-User End-to-End Testing (Playwright)
Build comprehensive multi-user end-to-end test scenarios validating complete user isolation, permission boundaries, and conversion workflows.

- [ ] **6.1 Multi-User Test Helper Utilities (`tests/e2e/helpers/auth.ts`)**
  - Provide `createAuthenticatedContext(browser, email)` helper to spin up isolated browser contexts with separate session cookies.
  - Add page helper getters in `tests/e2e/helpers/page-utils.ts` for favorite star buttons and author attribution badges.
- [ ] **6.2 End-to-End Test Suite (`tests/e2e/recipe-favorites-multi-user.e2e.ts`)**
  - **Scenario A: Cross-User Favoriting & Dashboard Separation:**
    - User A creates public recipe "Grandma's Sourdough".
    - User B opens User A's public recipe and clicks favorite star.
    - Verify User B's `/mise` dashboard displays recipe under Favorites with "by User A".
    - Verify User A's favorites list is unaffected.
  - **Scenario B: Unfavoriting & Sync:**
    - User B unfavorites from recipe header or dashboard; verify removal from User B's favorites without affecting User A's recipe.
  - **Scenario C: Author Edit Propagation:**
    - User A updates ingredients/directions on favorited recipe; verify User B sees updated content when opening from their favorites.
  - **Scenario D: Privacy Boundaries:**
    - Verify User B cannot favorite or view User A's private recipes.
  - **Scenario E: Unauthenticated Guest Conversion:**
    - Verify unauthenticated visitor clicking favorite star is routed to `/auth` with proper return parameter.
  - **Scenario F: Cascading Deletion:**
    - User A deletes recipe; verify foreign key cascade removes favorite record and User B's dashboard loads cleanly.

---

### Task 7: Documentation & Feature Registration
Update architectural and feature documentation to reflect multi-user favorites capabilities.

- [ ] **7.1 Feature Documentation (`docs/features/recipe-favorites.md`)**
  - Update documentation with the multi-user junction table model, public recipe favoriting, author badges, and API contracts.
- [ ] **7.2 Feature Index (`docs/features/README.md`)**
  - Verify and update feature references and links.

---

## 4. Affected Files Summary

### Add
- `supabase/migrations/20261101000000_user_recipe_favorites.sql` — Junction table, composite indexes, RLS policies, and backfill.
- `tests/e2e/recipe-favorites-multi-user.e2e.ts` — Multi-user Playwright end-to-end test suite.

### Modify
- `src/lib/server/db/schema.ts` — Drizzle table definition for `userRecipeFavorites`.
- `src/lib/server/bo/recipenodesbo.ts` — Multi-user favorite queries, toggle logic, batch checks, author metadata join.
- `src/lib/server/bo/recipenodesbo.test.ts` — Unit tests for cross-user favoriting and query isolation.
- `src/routes/mise/api/recipe-node/[nodeId]/favorite/+server.ts` — API endpoint supporting owned and public foreign favorites.
- `src/routes/recipe/[recipeNodeId]/+page.server.ts` — Load viewer favorite status for public recipe views.
- `src/lib/component/Recipe.svelte` — Interactive header favorite star button and optimistic state.
- `src/lib/component/PublicRecipe.svelte` — Interactive header favorite star button with auth redirect handler.
- `src/lib/component/RecipeDashboard.svelte` — Author attribution badges and navigation targets for external favorites.
- `src/routes/mise/+page.server.ts` — Dashboard favorites loader.
- `tests/e2e/helpers/auth.ts` — Multi-session test helper for isolated browser contexts.
- `tests/e2e/helpers/page-utils.ts` — Test selectors for header favorite star and author badges.
- `docs/features/recipe-favorites.md` — Updated feature specifications.
- `docs/features/README.md` — Feature registry.
