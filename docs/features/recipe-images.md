# Recipe images

Per-version and per-change images on recipes. The final-dish photo lives
on the recipe-node row (one image per version, null on fork). Ingredient
and direction images are lists of paths on the change body, with a
three-state replay contract so a fork with zero edits shows the
ancestor's images unchanged.

## Behaviour

- **Final-dish image** — singular photo per recipe version, shown in the
  recipe header. Owners can upload/remove via a "Set cover image" button
  (or remove via a trash button when one exists).
- **Ingredient/direction images** — list of paths on the change body.
  Forks fall through to the ancestor's images unless the leaf issues
  an explicit edit that sets or clears the field.
- **Inline thumbnails** — rows show thumbnails in a right-aligned strip
  next to the row content. Clicking a thumbnail opens a fullscreen
  lightbox at the page level (one shared `Dialog` instance, prev/next
  for multi-image rows, Escape to close).
- **Edit-form Images tab** — opens alongside the existing `details |
  note` tabs. Shows the inherited set as a faded hint and offers an
  "Inherit images from parent" button that copies the inherited paths
  onto the change record. The button is disabled when the local preview
  already matches the inherited set.
- **Two-phase upload** — uploads happen during the form session via
  `/mise/api/recipe-node/[nodeId]/<surface>`, returning a storage path
  the form layers into the local `imagePaths` preview. The change record
  is committed only after all uploads succeed.

## Data model

- `recipe_nodes.image_path: text | null` — single final-dish path
  (per-version). Drizzle column added in
  `20261015000100_recipe_node_image_path.sql`.
- `change_record.body.imagePaths: string[] | null | undefined` —
  per-change list. Three-state sentinel:
  - `undefined` → fall through (keep ancestor's)
  - `[]` → cleared by this change
  - `[a, b, c]` → replace with this list
- Materialized via `applyNodes` (pure): same logic as `note` but on
  `imagePaths`. Replay rule per row:
  ```
  imagePaths = []
  on 'add':                imagePaths = body.imagePaths ?? []
  on 'edit'/'substitute':  imagePaths = body.imagePaths ?? imagePaths   // undefined keeps
  ```

## Storage

Single bucket `recipe-images`, RLS-gated. Folder shape:

```
recipe-images/
  {ownerId}/
    nodes/{nodeId}/final.{ext}
    ingredients/{changeId}.{ext}
    directions/{changeId}.{ext}
```

RLS policies mirror the recipe_nodes ones: read/write your own folder
only (`auth.uid()::text = (storage.foldername(name))[1]`).

## API

- `POST /mise/api/recipe-node/[nodeId]/image` — multipart upload of the
  final-dish image; sets `recipe_nodes.image_path`.
- `DELETE /mise/api/recipe-node/[nodeId]/image` — clears the column and
  removes the storage object.
- `POST /mise/api/recipe-node/[nodeId]/change/[changeId]/image?kind=ingredient|direction`
  — multipart upload of a per-change image; returns `{ path }` for the
  form to layer into its local preview.
- `GET /mise/api/image?path=<storage-path>` — short-lived signed URL
  (302 redirect). Used by every `<img>` on the page; storage public URLs
  are never embedded directly.

## UI

- Lightbox at page level (`ImageLightbox.svelte`); one `Dialog.Portal`.
- `ImageStrip.svelte` for the inline read-mode thumbnail row.
- `ImageField.svelte` for the edit-form Images tab (Inherit affordance,
  upload button, local preview list, remove buttons).
- `data-testid`s: `tab-images`, `inherit-images-button`,
  `edit-images-inherited-hint`, `edit-images-preview`, `row-image`,
  `edit-image-thumb`, `edit-image-remove`, `upload-image-input`.

## Files

**Add**
- `supabase/migrations/20261015000000_recipe_images_bucket.sql`
- `supabase/migrations/20261015000100_recipe_node_image_path.sql`
- `src/lib/server/storage/imagePaths.ts` — path constructors + owner check
- `src/lib/component/ImageLightbox.svelte`
- `src/lib/component/ImageStrip.svelte`
- `src/lib/component/ImageField.svelte`
- `src/routes/mise/api/recipe-node/[nodeId]/image/+server.ts`
- `src/routes/mise/api/recipe-node/[nodeId]/change/[changeId]/image/+server.ts`
- `src/routes/mise/api/image/+server.ts`
- `tests/e2e/recipe-image-inherit.e2e.ts`

**Modify**
- `src/lib/server/db/schema.ts` — `imagePath` column on `recipeNodes`
- `src/lib/obj/Recipe.svelte.ts` — `imagePaths: string[] | null` on
  `Ingredient` / `Direction`
- `src/lib/obj/RecipeNode.svelte.ts` — `imagePath: string | null` on
  `RecipeNode`
- `src/lib/server/bo/recipenodesbo.ts` — mapper + replay
- `src/lib/server/bo/recipenodesbo.test.ts` — fixture + replay tests
- `src/lib/obj/recipeDiff.test.ts` — fixture
- `src/lib/component/IngredientRow.svelte`, `DirectionRow.svelte` —
  Images tab, Inherit affordance, inline strip
- `src/lib/component/Recipe.svelte` — final-dish header affordance,
  threads `inheritedImagePaths`, `nodeId`, `changeId` to rows,
  page-level lightbox
- `src/routes/recipe/[recipeNodeId]/+page.server.ts` — snake_case shadow
  picks up `image_path`
- `src/routes/mise/recipes/[slug]/+page.server.ts` — `inheritedImages`
  in the loader return

## Out of scope (for v1)

- On-the-fly image transforms (Supabase Storage v2 supports these; local
  dev doesn't enable them by default). Store originals; let `<img>` +
  CSS handle sizing.
- Storage lifecycle rules for orphans beyond delete-on-replace /
  delete-on-row-delete.
- Public bucket for public recipes. Server mints signed URLs for the
  public page render instead.
