# Features

User-facing capabilities of Grain of Salt, plus one dev-tooling doc
([demo data](./demo-data.md)). Each page describes the UI and the wiring
under it. The [project overview](../overview.md) explains the underlying
DAG model; recipe semantics are pinned by [ADR 0001](../adr/0001-per-node-in-place-edits.md)
and [ADR 0002](../adr/0002-fork-as-chain-extension.md).

## User-facing

- [Authentication](./authentication.md) — OTP email sign-in, account page, sign-out
- [Recipe tree](./recipe-tree.md) — Nested list of all recipes on the home page
- [Recipe creation](./recipe-creation.md) — Inline form on the home page
- [Recipe import](./recipe-import.md) — Import a recipe from a URL via JSON-LD parsing
- [Recipe view](./recipe-view.md) — `/recipes/[slug]` with materialized state and parent breadcrumbs
- [Recipe editing](./recipe-editing.md) — Add/edit/remove/reorder ingredients and directions, per-change notes, in-place save
- [Substitute change & descendant substitutes panel](./substitute-change.md) — `substitute` is syntactic sugar over `edit` (blue SUB badge); descendants' substitutes surface on the parent with a link back
- [Direction ingredient refs](./direction-ingredient-refs.md) — `#ingredient-id` references inside directions, rendered as inline chips with amount/unit
- [Autocomplete dropdown keyboard & insertion behavior](./autocomplete-dropdown-keyboard.md) — Tab/Shift+Tab navigate-only, Enter selects, picker splices `#<filter>` on select
- [Recipe history](./recipe-history.md) — Chain of nodes with color-coded diffs
- [Forking](./forking.md) — Append a new node to a recipe's chain (ADR 0002)
- [Recipe management](./recipe-management.md) — Rename and delete a recipe
- [Public recipe](./public-recipe.md) — Mark a node public; read-only view at `/recipe/[id]` without auth
- [Recipe favorites](./recipe-favorites.md) — Mark a node as favorite from the recipe actions menu; star appears next to the recipe name

## Development

- [Demo data](./demo-data.md) — Sample recipes populated by `scripts/seed.ts`
