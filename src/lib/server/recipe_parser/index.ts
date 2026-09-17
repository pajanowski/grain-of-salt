import type { Ingredient, Direction } from '$lib/obj/Recipe.svelte';
import { NewDirection } from '$lib/obj/Recipe.svelte';
import { extractRecipeFromJsonLd, parseIngredientString } from './adapters/jsonld';

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
	const directions = rawRecipe.instructions.map((text: string) => NewDirection(null, text));

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
			headers: {
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
			}
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
			const decoded = decodeHtmlEntities(parsed);
			const found = findRecipeInValue(decoded);
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

/**
 * Decode HTML entities (named, decimal `&#NN;`, hex `&#xNN;`) inside every
 * string value of a parsed JSON-LD tree. Some sites HTML-encode characters
 * inside `<script type="application/ld+json">` blocks (notably apostrophes
 * as `&#x27;`) to avoid breaking out of the script element; `JSON.parse`
 * leaves those entities as literal text.
 *
 * Only string values are touched — JSON keys and non-strings pass through.
 */
function decodeHtmlEntities(value: unknown): unknown {
	if (typeof value === 'string') return decodeString(value);
	if (Array.isArray(value)) return value.map(decodeHtmlEntities);
	if (value && typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const k of Object.keys(obj)) {
			out[k] = decodeHtmlEntities(obj[k]);
		}
		return out;
	}
	return value;
}

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: '\u00a0',
	copy: '©',
	reg: '®',
	trade: '™',
	mdash: '—',
	ndash: '–',
	hellip: '…',
	laquo: '«',
	raquo: '»',
	ldquo: '“',
	rdquo: '”',
	lsquo: '‘',
	rsquo: '’',
	middl: '—',
	iexcl: '¡',
	iquest: '¿',
	eacute: 'é',
	Eacute: 'É',
	egrave: 'è',
	Egrave: 'È',
	ecirc: 'ê',
	Ecirc: 'Ê',
	agrave: 'à',
	Agrave: 'À',
	aacute: 'á',
	Aacute: 'Á',
	acirc: 'â',
	Acirc: 'Â',
	iuml: 'ï',
	Iuml: 'Ï',
	ouml: 'ö',
	Ouml: 'Ö',
	auml: 'ä',
	Auml: 'Ä',
	uuml: 'ü',
	Uuml: 'Ü',
	ouml_: 'ö',
	Ouml_: 'Ö',
	ccedil: 'ç',
	Ccedil: 'Ç',
	ntilde: 'ñ',
	Ntilde: 'Ñ'
};

function decodeString(s: string): string {
	if (s.indexOf('&') === -1) return s;
	return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body: string) => {
		if (body[0] === '#') {
			const codePoint =
				body[1] === 'x' || body[1] === 'X'
					? parseInt(body.slice(2), 16)
					: parseInt(body.slice(1), 10);
			if (!Number.isFinite(codePoint)) return match;
			try {
				return String.fromCodePoint(codePoint);
			} catch {
				return match;
			}
		}
		const named = NAMED_ENTITIES[body];
		return named !== undefined ? named : match;
	});
}
