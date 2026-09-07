import type { Ingredient, Direction } from '$lib/obj/Recipe.svelte';
import { NewDirection } from '$lib/obj/Recipe.svelte';
import {
	extractRecipeFromJsonLd,
	parseIngredientString
} from './adapters/jsonld';

export interface ParsedRecipe {
	name: string;
	ingredients: Ingredient[];
	directions: Direction[];
	author: string | null;
	source: string | null;
}

export class ImportError extends Error {
	constructor(
		message: string,
		public readonly status: 400 | 422
	) {
		super(message);
		this.name = 'ImportError';
	}
}

/**
 * Parse a recipe from an HTML string already retrieved by the client.
 * Used when the browser can fetch a URL that blocks server-side requests.
 */
export function parseRecipeFromHtml(html: string, url: string): ParsedRecipe {
	const rawRecipe = extractJsonLdRecipe(html);
	if (!rawRecipe) {
		throw new ImportError(
			'Could not find a recipe on that page. Make sure the URL points to a recipe page with structured data.',
			400
		);
	}

	let source: string | null = null;
	try {
		source = new URL(url).hostname;
	} catch {
		// invalid URL, leave null
	}

	const ingredients = rawRecipe.ingredients.map(parseIngredientString);
	const directions = rawRecipe.instructions.map((text: string) =>
		NewDirection(null, text)
	);

	return {
		name: rawRecipe.name,
		ingredients,
		directions,
		author: rawRecipe.author,
		source
	};
}

/**
 * Fetch a URL, extract recipe data from JSON-LD, and return structured
 * ingredients + directions.
 *
 * Throws `ImportError` with:
 * - 400 if no Recipe JSON-LD block is found
 * - 422 if the URL can't be fetched
 */
export async function parseRecipeFromUrl(url: string): Promise<ParsedRecipe> {
	let html: string;
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(10_000),
			headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
		});
		if (!res.ok) {
			throw new ImportError(`Could not fetch URL: ${res.status} ${res.statusText}`, 422);
		}
		const contentType = res.headers.get('content-type') ?? '';
		if (!contentType.includes('text/html')) {
			throw new ImportError('URL did not return HTML', 422);
		}
		html = await res.text();
	} catch (e) {
		if (e instanceof ImportError) throw e;
		throw new ImportError(
			`Could not reach that URL: ${e instanceof Error ? e.message : String(e)}`,
			422
		);
	}

	return parseRecipeFromHtml(html, url);
}

/**
 * Find and parse a JSON-LD Recipe block inside an HTML string.
 * Handles all three common JSON-LD shapes: bare object, array, @graph wrapper.
 */
function extractJsonLdRecipe(
	html: string
): { name: string; ingredients: string[]; instructions: string[]; author: string | null } | null {
	const blocks = html.match(
		/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
	);
	if (!blocks) return null;

	for (const block of blocks) {
		const match = block.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
		if (!match) continue;
		const raw = match[1];
		try {
			const parsed = JSON.parse(raw);
			const found = findRecipeInValue(parsed);
			if (found) return found;
		} catch {
			// malformed JSON — skip
		}
	}

	return null;
}

function findRecipeInValue(
	val: unknown
): { name: string; ingredients: string[]; instructions: string[]; author: string | null } | null {
	if (Array.isArray(val)) {
		for (const item of val) {
			const found = findRecipeInValue(item);
			if (found) return found;
		}
		return null;
	}
	if (!val || typeof val !== 'object') return null;
	const obj = val as Record<string, unknown>;

	// @graph wrapper
	if (Array.isArray(obj['@graph'])) {
		for (const item of obj['@graph']) {
			const found = findRecipeInValue(item);
			if (found) return found;
		}
		return null;
	}

	return extractRecipeFromJsonLd(obj);
}
