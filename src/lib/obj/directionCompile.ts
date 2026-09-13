/**
 * Compile a direction body string into an array of text/chip segments.
 * Chip segments are identified by `#<uuid>` tokens that match ingredients.
 */
import type { Ingredient } from './Recipe.svelte.js';
import { formatAmount } from '../formatAmount.js';

export type ChipSegment = {
	type: 'chip';
	id: string;
	ingredient: Ingredient | null;
	displayText: string;
	start: number;
	end: number;
};

export type TextSegment = {
	type: 'text';
	value: string;
};

export type Segment = ChipSegment | TextSegment;

export interface CompileResult {
	compiled: Segment[];
	tokens: Array<{
		id: string;
		start: number;
		end: number;
		ingredient: Ingredient | null;
	}>;
}

/** UUID token pattern: # followed by 8-4-4-4-12 hex groups */
const UUID_TOKEN = /#[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function buildChipDisplayText(ingredient: Ingredient): string {
	const name = ingredient.name;
	if (!ingredient.amount && !ingredient.unit) return name;
	if (!ingredient.amount) return `${name} (${ingredient.unit})`;
	if (!ingredient.unit) return `${name} (${formatAmount(ingredient.amount)})`;
	return `${name} (${formatAmount(ingredient.amount)} ${ingredient.unit})`;
}

export function compileDirection(body: string, ingredients: Ingredient[]): CompileResult {
	const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));

	const tokens: CompileResult['tokens'] = [];
	let lastIndex = 0;

	for (const match of body.matchAll(UUID_TOKEN)) {
		const id = match[0].slice(1).toLowerCase();
		const ingredient = ingredientMap.get(id) ?? null;
		const displayText = ingredient ? buildChipDisplayText(ingredient) : match[0];

		tokens.push({
			id,
			start: match.index!,
			end: match.index! + match[0].length,
			ingredient
		});

		lastIndex = match.index! + match[0].length;
	}

	const compiled: Segment[] = [];
	if (tokens.length === 0) {
		compiled.push({ type: 'text', value: body });
		return { compiled, tokens };
	}

	// First segment
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
				? buildChipDisplayText(token.ingredient)
				: body.slice(token.start, token.end),
			start: token.start,
			end: token.end
		});

		// Text between this token and the next
		if (i < tokens.length - 1) {
			const nextStart = token.end;
			const nextTokenStart = tokens[i + 1].start;
			if (nextTokenStart > nextStart) {
				compiled.push({ type: 'text', value: body.slice(nextStart, nextTokenStart) });
			}
		} else if (token.end < body.length) {
			// Text after the last token
			compiled.push({ type: 'text', value: body.slice(token.end) });
		}
	}

	return { compiled, tokens };
}
