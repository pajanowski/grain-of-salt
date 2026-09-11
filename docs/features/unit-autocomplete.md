# Unit Autocomplete & Normalization — Requirements Doc

## Overview

Add an autocomplete dropdown for ingredient units, normalize known units on save (e.g. `cups` → `cup`), and display in natural language at read-only time (1 cup / 2 cups). Preserve custom/unknown units verbatim everywhere.

---

## Task A: Units constant map + utilities

**Files:** `src/lib/constants/units.ts`, `src/lib/unit.ts` (new)

**Goals:**
1. Create `COMMON_UNITS: Record<string, string>` mapping every common variant → canonical singular form. Covers at minimum:
   - cup/cups, teaspoon/teaspoons, tablespoon/tablespoons, ounce/ounces, pound/pounds
   - quart/quarts, gallon/gallons, liter/liters, kilogram/kilograms, gram/grams
   - pinch/pinches, clove/cloves, stalk/stalks, sprig/sprigs, piece/pieces
   - Anything commonly typed; defaults to lowercase keys via `.toLowerCase()`
2. Export `normalizeUnit(raw: string): string`:
   - Returns `COMMON_UNITS[raw.toLowerCase().trim()] ?? raw.trim()`
   - Unknown/custom units pass through unchanged
3. Export `displayUnit(canonical: string, amount: number): string`:
   - Returns `"unit"` when `amount === 1 || !isFinite(amount)`
   - Returns `"units"` (just append `s`) otherwise
   - Handle edge case where the unit is already pluralized by mistake (e.g. if DB has stale data): run `normalizeUnit` first, then apply display logic
4. If available, add a `pluralizeUnit(canonical: string): string` convenience function

**Deliverables:**
- `src/lib/constants/units.ts` with all entries
- `src/lib/unit.ts` with `normalizeUnit`, `displayUnit`, `pluralizeUnit`
- No runtime deps

**Acceptance criteria:**
- Every key in COMMON_UNITS maps to a value present as a key elsewhere
- `normalizeUnit("CUPS") === "cup"`, `normalizeUnit("") === ""`, `normalizeUnit("furlongs") === "furlongs"`
- `displayUnit("cup", 1) === "cup"`, `displayUnit("cup", 2) === "cups"`, `displayUnit("whole", 0.5) === "whole"`
- TypeScript compiles without errors

---

## Task B: UnitAutocomplete component

**File:** `src/lib/component/UnitAutocomplete.svelte` (new)

**Props API:**
```ts
type Props = {
  value?: string;           // current unit text
  onchange?: (value: string) => void;  // called on selection/blur/manual edit
};
```

**Behavior:**
1. Renders a styled `<input>` with Tailwind classes matching existing project inputs (`border rounded px-3 py-2 w-full` or similar to match `IngredientRow.svelte:140-142`).
2. When user types ≥1 character:
   - Filter `COMMON_UNITS` keys that **start with** the typed string (case-insensitive)
   - Show results as a positioned dropdown below the input
   - Highlight/selectable rows, keyboard navigation (↑/↓ arrows move focus, Enter selects, Escape closes)
3. Clicking a suggestion fills the input with the **canonical** name (`value` of COMMON_UNITS), not the variant
4. Typing freely still works — no forced selection; blur commits whatever is in the field
5. Dropdown closes on blur or Escape
6. Never blocks form submission or parent event handlers

**Styling constraints:**
- Use Tailwind classes consistent with the project (no arbitrary values unless unavoidable)
- Dropdown uses `position: absolute` beneath input, `z-index` higher than sibling elements (but check `ContextMenu` z-index to avoid overlap — keep it reasonable, e.g. `z-50`)
- Matches dark/light theme automatically (use `currentColor` semantics)

**Deliverables:**
- `src/lib/component/UnitAutocomplete.svelte`
- Clean build (`pnpm build`)

**Acceptance criteria:**
- Compiles without errors/warnings
- Tabindex 0, accessible label (or inherits placeholder role)
- Works with both controlled (`bind:value`) and one-way usage
- Dropdown doesn't overlap context menus (z-index audit against ContextMenu — currently `z-[999]` per previous ContextMenu fix — set to `z-50` or lower)
- Type-checked (Svelte compiler checks prop shapes)

---

## Task C: Wire IngredientRow + normalization at save

**File:** `src/lib/component/IngredientRow.svelte`

**Changes:**
1. Import `UnitAutocomplete` from `$lib/component/UnitAutocomplete.svelte`
2. Replace the plain unit input (`<input class="... flex-1" placeholder="Unit" bind:value={draft.unit}>`) with `<UnitAutocomplete {value: draft.unit} onchange={(u) => draft.unit = u}>`. Keep placeholder "Unit".
3. Import `normalizeUnit` from `$lib/unit`
4. In `doEdit()`, after parsing the amount successfully, normalize the unit before calling `onUpdate`:
   ```ts
   const normalizedUnit = normalizeUnit(draft.unit);
   onUpdate({ ...draft, amount: amtResult.value!, unit: normalizedUnit });
   ```
   Note: `onUpdate` type expects `(next: Ingredient) => void`; spreading `{ ...draft, amount, unit }` keeps the shape correct. The spread will include any other fields if added later.
5. Import `displayUnit` from `$lib/unit`
6. In the read-only rendering section, replace `{ingredient.unit}` with `{displayUnit(ingredient.unit, ingredient.amount)}` so public/editors show `"1 cup"` vs `"2 cups"` etc.

**Deliverables:**
- Modified `src/lib/component/IngredientRow.svelte`
- Clean build

**Acceptance criteria:**
- Edit flow: typing "Cups", "TEASPOONS", etc. auto-suggests canonical form; saving normalizes to canon
- Custom units like "pinch(es)" not in map: pass through unchanged
- Read-only view displays proper plurals based on amount
- Existing e2e tests still pass (they fill exact known values like `"cup"`, which is already canonical — no regression)

---

## Task D: E2E test additions

**File:** `tests/e2e/recipe-edit-changes.e2e.ts` (or new spec under `tests/e2e/`)

**Tests to add:**
1. **Autocomplete suggests canonical forms** — Focus unit input, type "cups" (or part thereof), verify dropdown appears with "cup" option, select it, verify input shows "cup"
2. **Custom units pass through** — Type a non-common unit like "furlongs", verify no suggestions appear, save succeeds, verify saved unit matches exactly what was typed
3. **Normalization persists** — Add an ingredient with unit "TABLESPOONS", save, reload page, verify stored/displayed unit is "tablespoon"
4. **Display pluralization** — Verify public/read-only view shows "1 cup" for single unit and "2 cups" for double

**Test style:** Follow existing patterns (`fillAddIngredient` helper, `page.getByPlaceholder('Unit')`, dialog confirmations). Use `playwright/test` fixtures as established in the repo.

**Acceptance criteria:**
- All new tests green alongside existing 35/35 suite
- Tests are deterministic, self-contained, no reseed needed

---

## Dependencies between tasks

| Task | Depends on |
|------|-----------|
| A (constants + utils) | None |
| B (autocomplete component) | None |
| C (wire IngredientRow + normalize) | A, B |
| D (e2e tests) | A, B, C |

A and B are fully independent — run in parallel. C depends on both outputs. D needs everything wired.

---

## Subagent Assignments

### SubAgent 1 (Task A)
**Goal:** Create `src/lib/constants/units.ts` with a comprehensive `COMMON_UNITS` record mapping common unit variants to their canonical singular forms. Create `src/lib/unit.ts` exporting `normalizeUnit(raw: string): string` (lookup + passthrough for unknowns), `displayUnit(canonical: string, amount: number): string` (singular vs plural at display time), and `pluralizeUnit(canonical: string): string` (canonical + "s"). Ensure TypeScript compiles cleanly.

### SubAgent 2 (Task B)
**Goal:** Create `src/lib/component/UnitAutocomplete.svelte` — a lightweight Svelte 5 combobox component. Props: `value?: string`, `onchange?(value: string)`. Renders a Tailwind-styled input; on typing ≥1 char, filters COMMON_UNITS keys prefix-match-insensitively, renders selectable dropdown below input. Keyboard nav: ↑/↓ arrows, Enter selects canonical form, Escape blurs. Always allows free text. Z-index ≤ 50. Must compile clean with no lint errors. Uses dynamic import or direct require of units data — pick whichever avoids circular dependency.

### SubAgent 3 (Task C)
**Goal:** Wire everything into `src/lib/component/IngredientRow.svelte`: import and use `<UnitAutocomplete>` replacing the plain unit `<input>`; normalize unit on save in `doEdit()` before calling `onUpdate`; use `displayUnit()` for read-only display instead of raw `{ingredient.unit}`. Build must succeed. No regressions in existing layout.

### SubAgent 4 (Task D)
**Goal:** Add 4 e2e tests covering autocomplete suggestions, custom-unit passthrough, normalization persistence across save/reload, and pluralized display in read-only mode. Follow existing test patterns in the repo. Run full Playwright suite and report result.
