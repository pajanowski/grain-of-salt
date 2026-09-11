import { UNIT_SYNONYMS } from '$lib/constants/units';

/** Normalize a raw unit string to its canonical singular form. Unknown words pass through. */
export function normalizeUnit(raw: string): string {
  const key = raw.trim().toLowerCase();
  return UNIT_SYNONYMS[key] ?? key;
}

/** Format a unit for display — singular when amount is 1 or non-finite, else plural. */
export function displayUnit(canonical: string, amount: number): string {
  if (amount === 1 || !Number.isFinite(amount)) {
    return canonical;
  }
  return `${canonical}s`;
}

/** Return the canonical plural form of a unit. */
export function pluralizeUnit(canonical: string): string {
  return `${canonical}s`;
}
