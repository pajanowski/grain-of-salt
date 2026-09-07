# Recipe import

A user pastes a URL pointing to a recipe on another site; the server fetches,
parses, and saves it as a new root node in the user's recipe tree.

## Flow

- The sidebar has an **"Import from URL"** button (download icon) next to the
  "Create Recipe" button.
- Clicking it opens an inline form with a URL text input and Import / Cancel
  buttons.
- On submit the button enters a loading state ("Importing…").
- Success: the new recipe appears in the tree; the form closes.
- Failure: an inline red error message appears under the input; the form stays
  open for retry.

## Server side

`POST /api/import` accepts `{ url: string }` and returns:

| Status | Body |
|--------|------|
| 201 | `{ recipe: Recipe }` |
| 400 | plain text error |
| 401 | — |
| 422 | plain text error (fetch / parse failed) |

## Parsing

The parser lives at `src/lib/server/recipe_parser.ts`. It exposes a single
async function:

```ts
parseRecipeFromUrl(url: string): Promise<ParsedRecipe>
```

Adapters for specific formats live under `recipe_parser/adapters/`. The
initial adapter handles **Recipe Schema (JSON-LD)**.

## Files

- `src/routes/+layout.svelte` — import button + inline form
- `src/routes/api/import/+server.ts` — `POST /api/import`
- `src/lib/server/recipe_parser.ts` — URL fetch + parser dispatch
- `src/lib/server/recipe_parser/adapters/jsonld.ts` — JSON-LD adapter
