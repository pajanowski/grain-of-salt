/**
 * Compile a direction body string into an array of text/chip segments.
 * Chip segments are identified by `#<uuid>` tokens that match ingredients.
 *
 * Thin re-export over `directionMask`. The mask library owns the actual
 * logic; this module exists so the existing `compileDirection` import
 * path keeps working while callers migrate at their own pace.
 */
import type { Ingredient } from './Recipe.svelte.js';
import { compileMaskedDirection } from './directionMask';

export type {
	DirectionChipSegment as ChipSegment,
	DirectionTextSegment as TextSegment,
	DirectionSegment as Segment,
	MaskedCompileResult as CompileResult
} from './directionMask';
export { buildIngredientDisplayName, formatDirectionBody } from './directionMask';

/** Compile a direction body into chip / text segments. */
export function compileDirection(body: string, ingredients: Ingredient[]) {
	return compileMaskedDirection(body, ingredients);
}
