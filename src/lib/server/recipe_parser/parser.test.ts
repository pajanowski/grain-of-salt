import { describe, it, expect } from 'vitest';
import { parseRecipeFromHtml } from './index';

function wrapRecipeLd(recipe: object): string {
	return `<html><head><script type="application/ld+json">${JSON.stringify(recipe)}</script></head><body></body></html>`;
}

describe('parseRecipeFromHtml', () => {
	it('extracts a recipe from a basic JSON-LD block', () => {
		const html = wrapRecipeLd({
			'@type': 'Recipe',
			name: 'Simple',
			recipeIngredient: ['1 cup flour'],
			recipeInstructions: [{ '@type': 'HowToStep', text: 'Mix.' }]
		});
		const r = parseRecipeFromHtml(html, 'https://example.com/recipe');
		expect(r.name).toBe('Simple');
		expect(r.ingredients[0].name).toBe('flour');
		expect(r.directions[0].body).toBe('Mix.');
	});

	it('decodes &#x27; HTML entity in JSON-LD string values', () => {
		// Recipe sites frequently HTML-encode apostrophes inside <script> tags
		// to avoid breaking out of the script element. JSON.parse leaves them
		// as literal `&#x27;` text — we need to decode them so apostrophes
		// render correctly.
		const recipe = {
			'@type': 'Recipe',
			name: 'Mom&#x27;s Best Brownies',
			recipeIngredient: ['1 cup grandma&#x27;s molasses', '2 eggs'],
			recipeInstructions: ['Bake in mom&#x27;s oven.']
		};
		const html = `<html><head><script type="application/ld+json">${JSON.stringify(recipe)}</script></head><body></body></html>`;
		const r = parseRecipeFromHtml(html, 'https://example.com/recipe');
		expect(r.name).toBe("Mom's Best Brownies");
		expect(r.ingredients[0].name).toBe("grandma's molasses");
		expect(r.directions[0].body).toBe("Bake in mom's oven.");
	});

	it('decodes other common HTML entities (named, decimal, hex)', () => {
		const recipe = {
			'@type': 'Recipe',
			name: 'Tom &amp; Jerry&#39;s &quot;Pie&quot; &#8212; &eacute;clat',
			recipeIngredient: ['Salt &amp; pepper'],
			recipeInstructions: []
		};
		const html = `<html><head><script type="application/ld+json">${JSON.stringify(recipe)}</script></head><body></body></html>`;
		const r = parseRecipeFromHtml(html, 'https://example.com/recipe');
		expect(r.name).toBe('Tom & Jerry\'s "Pie" — éclat');
		expect(r.ingredients[0].name).toBe('Salt & pepper');
	});

	it('preserves characters that look entity-like but are not real entities', () => {
		// Plain `&` (without a trailing semicolon or known name) and `;` alone
		// must pass through untouched. Only real HTML entities decode.
		const html = wrapRecipeLd({
			'@type': 'Recipe',
			name: 'AT&T recipe; a classic',
			recipeIngredient: [],
			recipeInstructions: []
		});
		const r = parseRecipeFromHtml(html, 'https://example.com/recipe');
		expect(r.name).toBe('AT&T recipe; a classic');
	});

	it('returns ImportError-shaped failure when no JSON-LD block exists', () => {
		const html = '<html><body>nothing</body></html>';
		expect(() => parseRecipeFromHtml(html, 'https://example.com')).toThrow(/recipe/);
	});
});
