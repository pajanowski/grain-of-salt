/**
 * IMask-based mask for direction bodies.
 *
 * The stored body uses `#<ingredient-uuid>` tokens. When rendered, each
 * token is swapped for `#<ingredient-name>` so the author reads a
 * recipe without scrolling back to the ingredient list. The display
 * formatting reuses `buildIngredientDisplayName` so amounts and units
 * match the chip overlay used by `compileDirection`.
 *
 * The mask is exposed two ways:
 *
 * 1. `formatDirectionBody(body, ingredients)` — pure transform.
 *    Use this anywhere a direction body needs to be displayed read-only.
 * 2. `DirectionMasked` — an `IMask.Masked` subclass plus a factory
 *    `createDirectionMask(opts)` that wires it into the IMask runtime.
 *    Use this when binding the mask to a live `<textarea>` via IMask's
 *    view layer.
 */
import IMask from 'imask';
import type { MaskedOptions } from 'imask';
import type { Ingredient } from './Recipe.svelte.js';
import { formatAmount } from '../formatAmount.js';

/** UUID token pattern: `#` followed by 8-4-4-4-12 hex groups. */
export const UUID_TOKEN = /#[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Options accepted by the direction mask. */
export interface DirectionMaskOptions {
	/** Ingredients available to resolve `#uuid` tokens against. */
	ingredients: Ingredient[];
}

/** Masked-model options for the direction mask. */
export type DirectionMaskedOptions = Partial<MaskedOptions<DirectionMasked>> &
	DirectionMaskOptions & { mask?: never };

/** Build the in-text reference label shown in place of `#uuid`. */
export function buildIngredientDisplayName(ingredient: Ingredient): string {
	const name = ingredient.name;
	if (!ingredient.amount && !ingredient.unit) return name;
	if (!ingredient.amount) return `${name} (${ingredient.unit})`;
	if (!ingredient.unit) return `${name} (${formatAmount(ingredient.amount)})`;
	return `${name} (${formatAmount(ingredient.amount)} ${ingredient.unit})`;
}

/**
 * Pure transform: swap `#uuid` tokens in `body` for `#<name>` using the
 * supplied ingredient list. Unknown ids pass through unchanged so that
 * stale references survive a fork.
 */
export function formatDirectionBody(body: string, ingredients: Ingredient[]): string {
	if (!body) return body;
	const ingredientMap = new Map(ingredients.map((i) => [i.id.toLowerCase(), i]));
	return body.replace(UUID_TOKEN, (match) => {
		const id = match.slice(1).toLowerCase();
		const ingredient = ingredientMap.get(id);
		return ingredient ? `#${ingredient.name}` : match;
	});
}

/** Any direction body text is valid — the mask is a formatter, not a constraint. */
const acceptAll = () => true;

/**
 * A single segment of a masked direction body, with explicit offsets in
 * both the raw `#<uuid>` body and the masked `#<name>` display. The
 * raw offsets are what the model stores; the display offsets are what
 * the textarea shows.
 *
 * Chip segments cover a `#<name>` substring in the display and the
 * matching `#<uuid>` substring in raw.
 */
export interface MaskedSegment {
	type: 'text' | 'chip';
	value: string;
	/** Inclusive left / exclusive right offset in the raw body. */
	rawStart: number;
	rawEnd: number;
	/** Inclusive left / exclusive right offset in the masked display. */
	displayStart: number;
	displayEnd: number;
	/** For chips: the resolved ingredient (or null for unknown uuids). */
	ingredient?: Ingredient | null;
	/** For chips: the original raw `#<uuid>` text. */
	rawValue?: string;
}

/** Compiled masked body: the display string plus per-segment offsets. */
export interface MaskedBody {
	display: string;
	segments: MaskedSegment[];
}

/**
 * Tokenise a raw `#<uuid>` body into display + per-segment offsets.
 *
 * The display string is the same as `formatDirectionBody(body,
 * ingredients)`. Each segment knows where it lives in both raw and
 * display coordinates, so edit handlers can map display-position
 * keystrokes back to raw-body edits.
 */
export function tokenizeMaskedBody(body: string, ingredients: Ingredient[]): MaskedBody {
	const segments: MaskedSegment[] = [];
	const ingredientMap = new Map(ingredients.map((i) => [i.id.toLowerCase(), i]));

	let rawIndex = 0;
	let lastRawIndex = 0;
	let lastDisplayIndex = 0;

	const pushText = (rawText: string, displayText: string = rawText) => {
		if (rawText.length === 0) return;
		segments.push({
			type: 'text',
			value: rawText,
			rawStart: lastRawIndex,
			rawEnd: lastRawIndex + rawText.length,
			displayStart: lastDisplayIndex,
			displayEnd: lastDisplayIndex + displayText.length
		});
		lastRawIndex += rawText.length;
		lastDisplayIndex += displayText.length;
	};

	for (const match of body.matchAll(UUID_TOKEN)) {
		const id = match[0].slice(1).toLowerCase();
		const ingredient = ingredientMap.get(id) ?? null;
		const start = match.index!;

		// Any plain text between the previous token and this one.
		if (start > rawIndex) {
			pushText(body.slice(rawIndex, start));
		}

		const displayText = ingredient ? `#${ingredient.name}` : match[0];
		segments.push({
			type: 'chip',
			value: displayText,
			rawStart: start,
			rawEnd: start + match[0].length,
			displayStart: lastDisplayIndex,
			displayEnd: lastDisplayIndex + displayText.length,
			ingredient,
			rawValue: match[0]
		});
		lastRawIndex = start + match[0].length;
		lastDisplayIndex += displayText.length;
		rawIndex = lastRawIndex;
	}

	// Trailing text after the last token.
	if (lastRawIndex < body.length) {
		pushText(body.slice(lastRawIndex));
	}

	return { display: body.replace(UUID_TOKEN, (m) => {
		const id = m.slice(1).toLowerCase();
		const ingredient = ingredientMap.get(id);
		return ingredient ? `#${ingredient.name}` : m;
	}), segments };
}

/**
 * Map a position in the masked display string to a position in the raw
 * body. Returns the smallest raw-position such that the display prefix
 * up to and including this position is consistent with the raw prefix.
 *
 * The returned position always lands at a "boundary" — a token start or
 * end — so callers can safely slice the raw body at that offset.
 */
export function displayToRaw(displayPos: number, masked: MaskedBody): number {
	const { segments } = masked;
	if (displayPos <= 0) return 0;
	if (segments.length === 0) return Math.min(displayPos, masked.display.length);

	// Find the segment containing `displayPos`. For chips, position
	// inside the chip maps to the chip's start in raw (clip on the
	// left, since chip content is atomic).
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		if (displayPos <= seg.displayStart) return seg.rawStart;
		if (displayPos < seg.displayEnd) {
			// Inside the segment. For chips, clip on the left.
			if (seg.type === 'chip') return seg.rawStart;
			// For text segments, the relative offset is the same.
			const offset = displayPos - seg.displayStart;
			return seg.rawStart + offset;
		}
		// displayPos === seg.displayEnd: fall through; equality at this
		// segment's end is the same as the next segment's start in raw.
		if (displayPos === seg.displayEnd) return seg.rawEnd;
	}
	// Past the last segment: end of raw body.
	return masked.segments[masked.segments.length - 1].rawEnd;
}

/**
 * Inverse of `displayToRaw`: map a position in the raw body to the
 * corresponding position in the masked display string. Positions
 * inside a chip's raw range map to the chip's display start (left
 * side) so callers place the caret at the chip boundary.
 */
export function rawToDisplay(rawPos: number, masked: MaskedBody): number {
	const { segments } = masked;
	if (rawPos <= 0) return 0;
	for (const seg of segments) {
		if (rawPos <= seg.rawStart) return seg.displayStart;
		if (rawPos < seg.rawEnd) {
			if (seg.type === 'chip') return seg.displayStart;
			return seg.displayStart + (rawPos - seg.rawStart);
		}
		if (rawPos === seg.rawEnd) return seg.displayEnd;
	}
	return masked.display.length;
}

/**
 * Structured tokenisation of a direction body, used by overlays that
 * want chip-level affordances (Change / Remove) rather than a plain
 * text replacement. Mirrors the `CompileResult` shape of the legacy
 * `compileDirection` helper so existing renderers can be migrated by
 * swapping the import.
 */
export interface DirectionChipSegment {
	type: 'chip';
	id: string;
	ingredient: Ingredient | null;
	displayText: string;
	start: number;
	end: number;
}

export interface DirectionTextSegment {
	type: 'text';
	value: string;
}

export type DirectionSegment = DirectionChipSegment | DirectionTextSegment;

export interface MaskedCompileResult {
	compiled: DirectionSegment[];
	tokens: Array<{
		id: string;
		start: number;
		end: number;
		ingredient: Ingredient | null;
	}>;
}

/**
 * Compile a direction body into structured chip / text segments using
 * the mask library. Each `#<uuid>` is matched against `ingredients`;
 * resolved tokens get a chip segment carrying `displayText =
 * buildIngredientDisplayName(ingredient)` so renderers can keep their
 * existing chip UI.
 */
export function compileMaskedDirection(body: string, ingredients: Ingredient[]): MaskedCompileResult {
	const ingredientMap = new Map(ingredients.map((i) => [i.id.toLowerCase(), i]));

	const tokens: MaskedCompileResult['tokens'] = [];

	for (const match of body.matchAll(UUID_TOKEN)) {
		const id = match[0].slice(1).toLowerCase();
		const ingredient = ingredientMap.get(id) ?? null;

		tokens.push({
			id,
			start: match.index!,
			end: match.index! + match[0].length,
			ingredient
		});
	}

	const compiled: DirectionSegment[] = [];
	if (tokens.length === 0) {
		compiled.push({ type: 'text', value: body });
		return { compiled, tokens };
	}

	// First leading text segment, if any.
	if (tokens[0].start > 0) {
		compiled.push({ type: 'text', value: body.slice(0, tokens[0].start) });
	}

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		compiled.push({
			type: 'chip',
			id: token.id,
			ingredient: token.ingredient,
			displayText: token.ingredient
				? buildIngredientDisplayName(token.ingredient)
				: body.slice(token.start, token.end),
			start: token.start,
			end: token.end
		});

		// Text between this token and the next.
		if (i < tokens.length - 1) {
			const nextStart = token.end;
			const nextTokenStart = tokens[i + 1].start;
			if (nextTokenStart > nextStart) {
				compiled.push({ type: 'text', value: body.slice(nextStart, nextTokenStart) });
			}
		} else if (token.end < body.length) {
			compiled.push({ type: 'text', value: body.slice(token.end) });
		}
	}

	return { compiled, tokens };
}

/**
 * Masked model. The accepted/typed value is the **raw body** — that is
 * what `value` and `unmaskedValue` return — and `displayValue` returns
 * the formatted body with `#uuid` → `#<name>` substitutions.
 *
 * Subclassing `IMask.Masked` is the supported extension point: IMask
 * exposes `extractInput(fromPos, toPos, flags)` as the read-side hook
 * for `displayValue` and the view layer's `el.value` sync, so we
 * override it to drive the swap while leaving writes untouched.
 */
export class DirectionMasked extends IMask.Masked {
	/** Ingredients used to resolve `#uuid` references in the display. */
	declare ingredients: Ingredient[];

	override overwrite?: boolean | 'shift' | undefined;
	override eager?: boolean | 'remove' | 'append' | undefined;
	override skipInvalid?: boolean | undefined;
	override autofix?: boolean | 'pad' | undefined;

	constructor(opts: DirectionMaskedOptions) {
		super({ validate: acceptAll, ...opts });
		this.ingredients = opts.ingredients ?? [];
	}

	_update(opts: DirectionMaskedOptions) {
		super._update(opts);
		if (opts.ingredients !== undefined) this.ingredients = opts.ingredients;
	}

	override updateOptions(opts: DirectionMaskedOptions) {
		super.updateOptions(opts);
	}

	/**
	 * Read hook: returns the formatted body for display positions and
	 * the raw body for input/raw-extraction positions. IMask's view
	 * layer calls this with no `raw` flag when syncing the textarea
	 * value to `displayValue`, so the swap only happens for the
	 * rendered text — never the internal model.
	 *
	 * Note: the base `Masked.displayValue` getter returns `_value`
	 * directly; we override both `displayValue` and `extractInput` so
	 * range reads (which `displayValue.length` and `rawInputValue`
	 * flow through) also see formatted text. `value` / `unmaskedValue`
	 * keep the raw body, so any writer that stores input stays
	 * round-trip safe.
	 */
	override get displayValue(): string {
		return formatDirectionBody(this._value, this.ingredients);
	}

	override extractInput(
		fromPos: number = 0,
		toPos: number = this._value.length,
		flags: { raw?: boolean } = {}
	): string {
		// Range reads of the raw body go straight to `_value`. The
		// base class routes through `displayValue` which is now the
		// formatted text — using `_value` here keeps `value` /
		// `unmaskedValue` honest.
		if (flags && flags.raw) {
			return this._value.slice(fromPos, toPos);
		}
		return this.displayValue.slice(fromPos, toPos);
	}
}

/**
 * Build an `IMask.Masked`-compatible value for a direction body. Plug
 * the result into `IMask(element, { mask })` to mask a textarea.
 */
export function createDirectionMask(opts: DirectionMaskOptions): DirectionMasked {
	return new DirectionMasked(opts);
}
