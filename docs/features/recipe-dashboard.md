# Recipe dashboard

The recipe dashboard is displayed on the main home landing screen (`/mise`) when no specific recipe is selected. Built server-side by `getRecipeDashboard(ownerId)` and `getRecipeFavorites(ownerId)` and rendered by `RecipeDashboard.svelte` and `RecipeList.svelte`, it provides users with quick access to their favorited and most recently modified recipes, followed by the complete recipe tree.

## Behaviour

- The "Grain of Salt" sidebar/header label links directly to the home screen (`/mise`).
- When favorited recipes exist, a "Favorites" section appears at the top of the dashboard, listing favorited recipes in a 3-column responsive grid sorted by last edit date.
- Beneath favorites, a "Recent recipes" section displays up to 5 recently changed root recipes in a 3-column responsive grid, sorted descending by the most recent write across their lineage (root and descendants).
- Each card shows the name of the most recently edited recipe node (the fork or root), direct fork count (`N fork` / `N forks` when greater than zero), and a human-readable relative timestamp (e.g., "just now", "5 minutes ago", "2 hours ago").
- Clicking a card links directly to the recipe node (`/mise/recipes/[id]`).
- The full recipe list and tree hierarchy is rendered directly on the home page beneath the recent recipes section.
- Renders empty sections when the user has no recipes or is unauthenticated.

## Files

- `src/lib/component/RecipeDashboard.svelte` — dashboard container with favorites and recent recipe cards
- `src/lib/component/RecipeList.svelte` — recipe tree view rendered beneath recents on the home page
- `src/lib/formatDate.ts` — relative time formatting utility
- `src/routes/mise/+layout.svelte` — layout containing header home link to `/mise`
- `src/routes/mise/+page.svelte` — landing page view
- `src/routes/mise/+page.server.ts` — server loader calling `getRecipeDashboard` and `getRecipeFavorites`
- `src/lib/server/bo/recipenodesbo.ts` — `getRecipeDashboard`, `getRecipeFavorites`, and entry types
