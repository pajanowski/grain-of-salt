# Public Recipe

A user can mark a single recipe node **Public** from the "Recipe actions"
menu. That node's view becomes reachable without authentication at
`grainofsalt.app/recipe/:recipe_node_id` and renders the same materialized
recipe as the mise UI. Marking one node public exposes only that node's
view — siblings and ancestors stay private.

## Behaviour

- **Route**: `/recipe/[recipeNodeId]` — node UUID is the slug (already
  unguessable; no separate slug).
- **Auth**: none required to read. A signed-out browser gets the page
  if and only if the requested node has `is_public = true`.
- **404 on missing or private node**: an anonymous request for a node
  that doesn't exist or is private returns 404. Don't leak existence.
- **Read-only surface**: ingredients and directions render with the
  same look as the mise recipe page (rounded `border border-stone-200`,
  white card, amber section headers, `max-w-3xl` width). No "Add"
  buttons, no inline edit/delete/move, no per-row note editor, no
  unsaved-changes bar, no rename/fork/delete modal, no NodeChanges
  panel, no graph button.
- **Header**: recipe name + author (`by …`) + source (`via …`) if set.
  No breadcrumbs (skipping the chain context; some ancestors may be
  private and would 404 if clicked).
- **Sign-in CTA for forks**: a signed-out viewer sees a small "Sign in
  to fork" link below the page that points at `/auth`. Forking itself
  is unchanged and still requires auth + ownership of the source
  chain.
- **Toggle**: one menu item in the recipe actions menu whose label
  flips with state: **Make public** when private, **Make private**
  when public. Owner-only.
- **Share link**: when `isPublic = true`, the recipe header shows the
  public URL next to the recipe name with a copy-to-clipboard button,
  so the owner can grab the link immediately.
- **Caching**: the public page sets
  `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
  Shared links should not hammer the DB.
- **SEO**: `<title>` with the recipe name, `<meta name="description">`
  with a short summary, OG tags for nice link previews.

## Scope of "public"

**Per node, not per recipe.** Marking a Denver Omelette leaf public
does not mark the Simple Omelette root or the French Omelette sibling
public. Each node has its own `is_public` flag and its own public URL.

## Data model

Add one boolean column to `recipe_nodes`:

```sql
-- new migration: supabase/migrations/<ts>_public_recipe.sql
alter table public.recipe_nodes
  add column is_public boolean not null default false;

create index recipe_nodes_public_idx
  on public.recipe_nodes (is_public)
  where is_public = true;

-- Allow anonymous read of explicitly-public nodes. Existing RLS is
-- unchanged; this policy is additive and only exposes the rows the
-- owner has chosen to publish.
create policy recipe_nodes_select_public
  on public.recipe_nodes
  for select
  using (is_public = true);
```

Wire the column through:

- `src/lib/server/db/schema.ts` — add `isPublic` to `recipeNodes`,
  `InsertRecipeNode`, `SelectRecipeNode`.
- `src/lib/obj/RecipeNode.svelte.ts` — add `isPublic: boolean` to
  `RecipeNode` (default `false`).
- `src/lib/server/bo/recipenodesbo.ts` — surface `isPublic` in
  `toUiRecipeNode`.

## Routing

New route outside the `/mise/` group, so it inherits the minimal root
`+layout.svelte` (just `app.css`) and never renders the private
sidebar.

```
src/routes/recipe/[recipeNodeId]/+page.server.ts
src/routes/recipe/[recipeNodeId]/+page.svelte
```

**`+page.server.ts`** mirrors the existing
`/mise/recipes/[slug]/+page.server.ts` (chain walk via
`getRecipeNodesByRecipeIdV2`, then `applyNodes`) with two changes:

- Reads through the per-request Supabase client (`event.locals.supabase`,
  anon key when no session). The new RLS policy is what gates access;
  the handler does not check `locals.user`.
- Returns 404 if `history.length === 0` (node absent or not public).
- Sets the cache headers above.

**`+page.svelte`** composes a new `PublicRecipe.svelte` component.
No menu, no breadcrumbs, no auth wiring.

## UI

### `src/lib/component/PublicRecipe.svelte` (new)

Read-only renderer. Reuses the mise recipe styling verbatim:

- Wrapper: `<div class="mx-auto flex max-w-3xl flex-col gap-6">`
- Header: name + author + source. No Graph button, no ContextMenu.
- Ingredients section: same shell as `Recipe.svelte` (rounded card,
  amber-titled `Ingredients` heading, no Add button). Renders each
  ingredient via `IngredientRow readOnly={true}`.
- Directions section: same shell as `Recipe.svelte`. Renders each
  direction via `DirectionRow readOnly={true}`.
- Footer: signed-out users see "Sign in to fork this recipe" link to
  `/auth`. Signed-in viewers see no fork affordance on the public
  page (fork still requires ownership of the source chain — out of
  scope for the public surface).

### `IngredientRow.svelte` / `DirectionRow.svelte` — `readOnly` prop

Add a `readOnly?: boolean` prop (default `false`). When `true`:
hide the inline edit/delete/move controls and the note button. The
note text still renders if present, since notes are part of the
published recipe. No API change beyond the prop.

### `Recipe.svelte` — toggle + share link

Append to `menuItems`:

```ts
{
  label: data.currentNode.isPublic ? 'Make private' : 'Make public',
  onSelect: () => togglePublic()
}
```

`togglePublic()` calls `PATCH /mise/api/recipe-node/[nodeId]/public`
and `invalidateAll()`.

In the recipe header, when `data.currentNode.isPublic`, render the
public URL + copy-to-clipboard button inline next to the name.

## API

### `PATCH /mise/api/recipe-node/[nodeId]/public` (new)

`src/routes/mise/api/recipe-node/[nodeId]/public/+server.ts`.

- Owner-only. Reuses `assertNodeOwnership` from `recipenodesbo.ts`.
  On mismatch, returns 403; on missing node, 404; on no session, 401.
- Body: `{ isPublic: boolean }`. Validates type, then writes the
  column.
- Returns 200 + `{ isPublic: boolean }`.

No token, no separate slug — the UUID is the secret.

## Auth wiring

`/recipe/...` does not require a session. It lives outside `/mise/`,
so the existing `hooks.server.ts` `safeGetSession()` still runs but
the route simply doesn't gate on it. The server load uses
`event.locals.supabase`, which is an anon client when no session is
present and respects the new RLS policy.

## Files

### Add
- `supabase/migrations/<ts>_public_recipe.sql` — column + partial
  index + RLS policy
- `src/routes/recipe/[recipeNodeId]/+page.{svelte,server.ts}` —
  public page
- `src/lib/component/PublicRecipe.svelte` — read-only renderer
- `src/routes/mise/api/recipe-node/[nodeId]/public/+server.ts` —
  toggle endpoint
- `tests/e2e/public-recipe-unauth.e2e.ts` — public node reachable
  without session, full read-only render
- `tests/e2e/public-recipe-private-404.e2e.ts` — private node
  returns 404 to anonymous viewer
- `tests/e2e/public-recipe-link-copy.e2e.ts` — toggling public
  shows the share-link row and flips the menu label
- `tests/e2e/public-recipe-toggle-owner.e2e.ts` — non-owner cannot
  flip the flag (401/403)

### Modify
- `src/lib/server/db/schema.ts` — `isPublic` column on `recipeNodes`
- `src/lib/obj/RecipeNode.svelte.ts` — `isPublic` on `RecipeNode`
- `src/lib/server/bo/recipenodesbo.ts` — `isPublic` in `toUiRecipeNode`
- `src/lib/component/Recipe.svelte` — toggle menu item + share link
- `src/lib/component/IngredientRow.svelte` — `readOnly` prop
- `src/lib/component/DirectionRow.svelte` — `readOnly` prop
- `docs/features/README.md` — register this feature

## Out of scope

- Forking from the public page.
- Per-user share links, unlisted, or token-gated access.
- A "Public recipes" listing page; the URL is the entry point.
- Robots meta defaults to `index, follow` for public pages. Revisit
  if spam becomes an issue.

## Implementation order (for the agent picking this up)

1. Migration: add `is_public` column, partial index, RLS policy.
   Apply against local Supabase.
2. Wire `isPublic` through `schema.ts`, `RecipeNode.svelte.ts`,
   `toUiRecipeNode`. No UI changes yet.
3. `PATCH /mise/api/recipe-node/[nodeId]/public` endpoint + owner
   guard.
4. Add `readOnly` prop to `IngredientRow` and `DirectionRow`.
5. `PublicRecipe.svelte` component (read-only shell).
6. `src/routes/recipe/[recipeNodeId]/+page.{svelte,server.ts}` —
   RLS-gated read, cache headers, 404 on absent/private.
7. `Recipe.svelte` — add toggle menu item and share-link row,
   reusing the new endpoint.
8. Tests: write the four e2e tests, run `pnpm exec playwright test`,
   fix until green.
9. Update `docs/features/README.md` to link this file.
10. Smoke test: mark a node public, open the link in an incognito
    tab, confirm the page renders without any of the mise UI chrome.

## Verification

- Existing mise flow still works (regression: e2e tests in
  `tests/e2e/` pass unmodified).
- New e2e tests pass.
- An anonymous browser tab reaches the public URL with the full
  recipe and no editing chrome.
- A private node's URL returns 404 to anonymous viewers.
- The cache headers are present on the public response
  (`curl -I /recipe/<id>` shows `s-maxage=60`).
- Toggling public/private from the menu updates the UI without a
  reload.
