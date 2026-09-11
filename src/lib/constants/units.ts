/**
 * Common unit abbreviations and plurals mapped to their canonical form.
 * Order matters: more specific abbreviations should come before general ones.
 */
export const UNIT_SYNONYMS: Record<string, string> = {
  // Teaspoon
  tspn: 'teaspoon',
  tsp: 'teaspoon',
  teaspoons: 'teaspoon',
  teaspoon: 'teaspoon',
  // Tablespoon
  tbsp: 'tablespoon',
  tbsps: 'tablespoon',
  tablespoons: 'tablespoon',
  tablespoon: 'tablespoon',
  // Cup
  cups: 'cup',
  cup: 'cup',
  // Ounce
  oz: 'ounce',
  ozs: 'ounce',
  ounces: 'ounce',
  ounce: 'ounce',
  // Pound
  lb: 'pound',
  lbs: 'pound',
  pounds: 'pound',
  pound: 'pound',
  // Quart
  qt: 'quart',
  qts: 'quart',
  quarts: 'quart',
  quart: 'quart',
  // Gallon
  gal: 'gallon',
  gals: 'gallon',
  gallons: 'gallon',
  gallon: 'gallon',
  // Liter
  l: 'liter',
  litre: 'liter',
  litres: 'liter',
  liters: 'liter',
  liter: 'liter',
  // Kilogram
  kg: 'kilogram',
  kgs: 'kilogram',
  kilograms: 'kilogram',
  kilogram: 'kilogram',
  // Gram
  g: 'gram',
  grams: 'gram',
  gram: 'gram',
  // Plurals / singulars
  pinches: 'pinch',
  pinch: 'pinch',
  cloves: 'clove',
  clove: 'clove',
  stalks: 'stalk',
  stalk: 'stalk',
  sprigs: 'sprig',
  sprig: 'sprig',
  pieces: 'piece',
  piece: 'piece',
  wholes: 'whole',
  whole: 'whole',
  dashes: 'dash',
  dash: 'dash',
  bunches: 'bunch',
  bunch: 'bunch',
};

/**
 * Canonical unit labels shown in the dropdown.
 */
export const CANONICAL_UNITS: string[] = [
  'teaspoon',
  'tablespoon',
  'cup',
  'ounce',
  'pound',
  'quart',
  'gallon',
  'liter',
  'kilogram',
  'gram',
  'pinch',
  'clove',
  'stalk',
  'sprig',
  'piece',
  'whole',
  'dash',
  'bunch',
];
