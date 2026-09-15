# Autocomplete dropdown keyboard & insertion behavior

Plan to fix two bugs in the shared autocomplete dropdown (`AutocompleteDropdown.svelte`)
and its call sites in the direction ingredient picker.

## Bugs

### #1 — Tab auto-selects the highlighted item

`AutocompleteDropdown.svelte` currently treats forward Tab as the activation key
(single-select listbox ARIA pattern). The user wants Tab to be a navigation
key only: Tab highlights the next item, Shift+Tab the previous, and Enter is
the only path that selects (besides mouse click).

The same global keydown handler is what the `#`-trigger ingredient picker in
direction textareas rides on, so the fix is in one place and applies
project-wide (unit autocomplete and ingredient picker both stop auto-selecting
on Tab).

### #2 — Picker leaves the typed `#<filter>` prefix behind on Enter-select

When the user types `#Sug` in a direction textarea and presses Enter on Sugar,
the raw body becomes `#<sugar-uuid>Sug` (the picker inserts `#<uuid>` at the
position of the `#` but never removes the `Sug` the user typed after it). The
masked view then renders as `#SugarSug` — two references where one was wanted.

The "Replace" branch (changing an existing chip) is fine; only the
"plain prefix" branch is buggy.

## Files to change

- `src/lib/component/AutocompleteDropdown.svelte` — bug #1, plus the file's
  top-of-file comment that misdescribes the keyboard contract.
- `src/lib/component/Recipe.svelte` — bug #2 (add-direction picker).
- `src/lib/component/DirectionRow.svelte` — bug #2 (edit-direction picker).
- `docs/features/direction-ingredient-refs.md` — update the keyboard section
  that still claims "Tab inserts".
- `tests/e2e/direction-ingredient-ref.e2e.ts` — remove `test.only` once the
  test passes, so the rest of the suite runs again.
- `tests/e2e/unit-autocomplete.e2e.ts` — likely unchanged (tests still use
  Tab+Enter; same end state, just Enter does the selecting now). Verify on
  first run.

## Out of scope

- `src/lib/obj/directionMask.ts`, `src/lib/action/directionMask.ts` — the
  splice fix lives in component code, the mask library is unaffected.
- The mouse `onclick` and `onmouseenter` paths on options — these already
  behave correctly (click selects, hover highlights).

## Decisions

- **Trailing space after Enter-select.** Yes. The picker appends a single
  trailing space if the next character isn't whitespace, matching the
  existing `pickIngredientFromDirection` helper's behavior.
- **Tab on empty-filtered dropdown.** Close + fall through to the next
  field. Today that's the behavior; keep it.
- **Initial highlight when dropdown opens.** Set `highlightedIndex = 0`
  when the dropdown opens with at least one item, mirroring native listbox
  ("opens focused on first option"). Today it stays at `-1` until the user
  presses a key, so the first Tab from a fresh open does nothing visible.

## Tasks

### T1. Fix Tab/Shift+Tab to navigate-only in `AutocompleteDropdown.svelte`

- Remove the `selectIndex(...)` call from the global keydown `Tab` branch
  (around lines 117–128). Result: Tab and Shift+Tab both just move
  `highlightedIndex`; only Enter and click select.
- Remove the matching `selectIndex(...)` from the local listbox `Tab`
  branch (around lines 72–83). Same change, same reason.
- Update the file's top-of-file comment (lines 1–18) to reflect the new
  keyboard contract: "Tab/Shift+Tab move highlight, Enter activates,
  Escape closes."

### T2. Open the dropdown with the first option highlighted

- In the effect that resets `highlightedIndex` when `open` changes (around
  lines 160–166), set `highlightedIndex = 0` when the dropdown opens and
  has at least one item, instead of leaving it at `-1`.

### T3. Fix `#<filter>` removal in `handleAddDirectionPickerPick` (Recipe.svelte)

In `Recipe.svelte::handleAddDirectionPickerPick` (around lines 421–448):

- In the "no existing chip" branch, expand the splice to cover the entire
  `#<filter>` token, not just the `#`. Find the end of the trailing
  whitespace-delimited token after `hashIdx`, then:
  - `head = newDirection.body.slice(0, rawPos(hashIdx))`
  - `tail = newDirection.body.slice(rawPos(tokenEnd))` where `tokenEnd` is
    the next whitespace after `hashIdx` in the displayed textarea (or end
    of value if none).
  - `newDirection.body = head + '#' + id + tail + (tailWhitespacePad)`.
- Translation from displayed token boundary to raw-body boundary uses the
  existing `displayToRaw` helper the way the current code already does.
- The "Replace existing chip" branch is unchanged.
- After splice: if `newDirection.body[rawPos(tokenEnd)]` is not whitespace,
  append a single space.

### T4. Same fix in `handlePickerPick` (DirectionRow.svelte)

- Apply the same edit-logic change to `DirectionRow.svelte::handlePickerPick`
  (around lines 298–331). Same `hashIdx`/`tokenEnd`/splice pattern.

### T5. Update the feature doc

- In `docs/features/direction-ingredient-refs.md` lines 119–120, replace
  "Tab inserts and adds a trailing space if not already present" with
  "Tab/Shift+Tab move highlight; Enter selects and inserts (trailing space
  added if next char isn't whitespace)."

### T6. Drop `test.only` from the failing test

- `tests/e2e/direction-ingredient-ref.e2e.ts` line 394: remove `.only` so
  the rest of the suite runs again.

### T7. Verify

- `pnpm exec vitest run` (or `pnpm test`) for unit tests — the IMask /
  direction-mask unit tests should be unaffected.
- `just agent-e2e tests/e2e/direction-ingredient-ref.e2e.ts` — the
  failing test must pass.
- `just agent-e2e tests/e2e/unit-autocomplete.e2e.ts` — Tab+Enter tests
  must still pass (same end state, different keystroke responsibility).
- `just agent-e2e tests/e2e/direction-picker-debug.e2e.ts` — broader
  picker flow (T1–T6 in that file).
- Manual smoke: open the add-direction form, type `#Sug`, press Tab
  (highlights Sugar), press Enter (textarea reads `Add #Sugar ` with a
  trailing space), press Backspace once (chip deletes atomically).

## Risks

- The `AutocompleteDropdown` global keydown capture uses `preventDefault` +
  `stopPropagation` on Tab today; after the fix it still does — Tab while
  the dropdown is open no longer falls through to whatever focusable
  element would have been next. That matches the native listbox behavior
  and is what the user asked for. Watch for: any caller that relies on Tab
  moving past the textarea while the picker is open. The existing
  `direction-picker-debug.e2e.ts` T4/T5 cover this path.
- The "Replace existing chip" path in `handleAddDirectionPickerPick`
  ignores the typed text entirely, which is correct for "change this chip"
  but would silently drop any extra text after the chip's display end if
  a user typed past it. Today the caret sits at end-of-chip when the picker
  opens (the existing chip occupies that display range), so this is a
  theoretical risk only. No change needed for v1.

## Files

- `src/lib/component/AutocompleteDropdown.svelte`
- `src/lib/component/Recipe.svelte`
- `src/lib/component/DirectionRow.svelte`
- `docs/features/direction-ingredient-refs.md`
- `tests/e2e/direction-ingredient-ref.e2e.ts`
- `tests/e2e/unit-autocomplete.e2e.ts` (verify only)
- `tests/e2e/direction-picker-debug.e2e.ts` (verify only)
