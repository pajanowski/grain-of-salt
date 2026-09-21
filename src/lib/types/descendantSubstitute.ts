/**
 * Client-side re-export of the `DescendantSubstitute` type so
 * browser components can refer to it without dragging the server
 * function `findDescendantSubstitutes` into the client bundle.
 *
 * The source of truth lives in `$lib/server/bo/recipenodesbo.ts` —
 * this file just `import type`s it. `import type` is erased at compile
 * time, so no server code ships to the browser.
 */
export type { DescendantSubstitute } from '$lib/server/bo/recipenodesbo';
