import { v4 as uuid } from 'uuid';
import type { Ingredient } from '$lib/obj/Recipe.svelte';

/**
 * Extract a Recipe from a parsed JSON-LD graph.
 * Returns null if the object is not a Recipe.
 */
export function extractRecipeFromJsonLd(
	obj: unknown
): { name: string; ingredients: string[]; instructions: string[]; author: string | null } | null {
	if (!isRecipeSchema(obj)) return null;

	const name = typeof obj.name === 'string' ? obj.name.trim() : '';
	const ingredients = parseIngredients(obj.recipeIngredient);
	const instructions = parseInstructions(obj.recipeInstructions);
	const author = extractAuthor(obj.author);

	if (!name) return null;

	return { name, ingredients, instructions, author };
}

function isRecipeSchema(v: unknown): v is JsonLdRecipe {
	if (!v || typeof v !== 'object') return false;
	const t = (v as Record<string, unknown>)['@type'];
	const types = Array.isArray(t) ? t : [t];
	return types.some((tt) =>
		['Recipe', 'https://schema.org/Recipe', 'http://schema.org/Recipe'].includes(
			String(tt)
		)
	);
}

function parseIngredients(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((x): x is string => typeof x === 'string')
		.map((s) => s.trim())
		.filter(Boolean);
}

function parseInstructions(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	for (const item of raw) {
		collectInstructionText(item, out);
	}
	return out;
}

function collectInstructionText(item: unknown, out: string[]): void {
	if (typeof item === 'string') {
		out.push(item.trim());
		return;
	}
	if (!item || typeof item !== 'object') return;
	const obj = item as Record<string, unknown>;
	if (typeof obj.text === 'string') {
		out.push(obj.text.trim());
	}
	if (Array.isArray(obj.itemListElement)) {
		for (const child of obj.itemListElement) collectInstructionText(child, out);
	}
}

/** Convert a flat ingredient string like "2 cups flour" to an Ingredient. */
export function parseIngredientString(s: string): Ingredient {
	const trimmed = s.trim();
	if (!trimmed) return { id: uuid(), name: '', amount: 0, unit: '' };

	let amount = 0;
	let remaining = trimmed;

	// 1. Match leading amount: optional integer + fraction (unicode or ASCII) or decimal
	const unicodeFrac = matchUnicodeFraction(remaining);
	if (unicodeFrac) {
		amount = unicodeFrac.value;
		remaining = unicodeFrac.rest;
	} else {
		const asciiFrac = remaining.match(/^(\d+\/\d+|\d+(?:\.\d+)?)(?:\s+(\d+\/\d+))?\s*/);
		if (asciiFrac) {
			const amountStr = asciiFrac[2] ? `${asciiFrac[1]} ${asciiFrac[2]}` : asciiFrac[1];
			amount = parseAmountString(amountStr);
			remaining = remaining.slice(asciiFrac[0].length);
		}
	}
	let unit = '';
	// Compound "digit-unit" pattern (e.g. "8-oz.", "15-oz.") after a
	// leading count. Convert to amount + unit, drop from remainder.
	const compoundMatch = remaining.match(/^(\d+)-([a-zA-Z]+)\.?\s*/);
	if (compoundMatch && isUnit(compoundMatch[2].toLowerCase())) {
		amount = parseFloat(compoundMatch[1]);
		unit = compoundMatch[2].toLowerCase();
		remaining = remaining.slice(compoundMatch[0].length);
	}

	// Optional standalone unit (with or without trailing period)
	const words = remaining.split(/\s+/).filter(Boolean);
	let nameStart = 0;
	if (words.length > 1 && !unit) {
		const first = words[0].toLowerCase().replace(/\.$/, '');
		if (isUnit(first)) {
			unit = words[0].replace(/\.$/, '');
			nameStart = 1;
		}
	}

	const name = words.slice(nameStart).join(' ').trim();
	return { id: uuid(), name: name || trimmed, amount, unit };
}

interface FractionMatch {
	value: number;
	rest: string;
}

/**
 * Match a leading amount that starts with a unicode fraction, optionally
 * preceded by an integer (e.g. "½", "1½", "½tsp").
 */
function matchUnicodeFraction(s: string): FractionMatch | null {
	const FRAC_CHARS = Object.keys(UNICODE_FRACTIONS).join('');
	const re = new RegExp(`^(\\d)?([${FRAC_CHARS}])`);
	const m = s.match(re);
	if (!m) return null;
	const integerPart = m[1] ? parseInt(m[1], 10) : 0;
	const fracVal = UNICODE_FRACTIONS[m[2]];
	return { value: integerPart + fracVal, rest: s.slice(m[0].length).trimStart() };
}

/** Parse "1", "1.5", "1/2", "1 1/2" into a number. */
function parseAmountString(raw: string): number {
	const trimmed = raw.trim();
	if (trimmed.includes(' ')) {
		const parts = trimmed.split(/\s+/);
		const int = parseFloat(parts[0]);
		const [n, d] = parts[1].split('/').map(parseFloat);
		return int + (d !== 0 ? n / d : 0);
	}
	if (trimmed.includes('/')) {
		const [n, d] = trimmed.split('/').map(parseFloat);
		return d !== 0 ? n / d : 0;
	}
	return parseFloat(trimmed);
}

function isUnit(word: string): boolean {
	if (UNIT_WORDS[word]) return true;
	// Allow common plural/singular variants
	if (UNIT_WORDS[word.replace(/s$/, '')]) return true;
	return false;
}

const UNICODE_FRACTIONS: Record<string, number> = {
	'½': 0.5,
	'⅓': 1 / 3,
	'⅔': 2 / 3,
	'¼': 0.25,
	'¾': 0.75,
	'⅕': 0.2,
	'⅖': 0.4,
	'⅗': 0.6,
	'⅘': 0.8,
	'⅙': 1 / 6,
	'⅚': 5 / 6,
	'⅛': 0.125,
	'⅜': 0.375,
	'⅝': 0.625,
	'⅞': 0.875
};

const UNIT_WORDS: Record<string, true> = {
	tsp: true,
	teaspoon: true,
	teaspoons: true,
	tbsp: true,
	tablespoon: true,
	tablespoons: true,
	cup: true,
	cups: true,
	oz: true,
	ounce: true,
	ounces: true,
	lb: true,
	lbs: true,
	pound: true,
	pounds: true,
	g: true,
	gram: true,
	grams: true,
	kg: true,
	ml: true,
	l: true,
	liter: true,
	liters: true,
	dl: true,
	cl: true,
	pinch: true,
	pinches: true,
	dash: true,
	dashes: true,
	slice: true,
	slices: true,
	clove: true,
	cloves: true,
	piece: true,
	pieces: true,
	can: true,
	cans: true,
	bunch: true,
	bunches: true,
	sprig: true,
	sprigs: true,
	handful: true,
	handfuls: true,
	medium: true,
	large: true,
	small: true,
	stick: true,
	sticks: true,
	package: true,
	pkg: true,
	pack: true,
	packs: true,
	sheet: true,
	sheets: true
};

// Minimal JSON-LD Recipe type
interface JsonLdRecipe {
	'@type': string | string[];
	name?: unknown;
	recipeIngredient?: unknown;
	recipeInstructions?: unknown;
	author?: unknown;
	text?: unknown;
	itemListElement?: unknown;
}

/** Extract a display-name string from a JSON-LD author value. */
function extractAuthor(author: unknown): string | null {
	if (!author) return null;
	if (typeof author === 'string') return author.trim() || null;
	if (Array.isArray(author)) {
		const names = author
			.map((a) => extractAuthor(a))
			.filter((n): n is string => Boolean(n));
		return names.length > 0 ? names.join(', ') : null;
	}
	if (typeof author === 'object') {
		const obj = author as Record<string, unknown>;
		if (typeof obj.name === 'string') return obj.name.trim() || null;
	}
	return null;
}

