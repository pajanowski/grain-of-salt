# Direction ingredient references

Authors can reference an ingredient inside a direction body with `#`,
so the rendered output shows the ingredient's name with its amount and
unit inline. This keeps recipes readable when a direction is read
without first scrolling back to the ingredient list.

The references are resolved against the **compiled recipe**'s
ingredients — not just the leaf's — so a direction can reference an
ingredient that was added on any ancestor node in the chain.

## Syntax

A reference is `#<ingredient-uuid>` written inside a direction body.
The only reserved sigil is `#` followed by a UUID-shaped identifier.
There is no escape mechanism in v1.

Stored examples (unchanged shape — `body` stays plain text):

```
Add #a3f2e1c4-9b8d-4a01-b2c3-4d5e6f708192 to the bowl.
Stir in #a3f2e1c4-9b8d-4a01-b2c3-4d5e6f708192 and #b91c7d4e-1234-5678-9abc-def012345678 together.
```

## Compile rule

A pure function `compileDirection(body, ingredients)` in
`src/lib/obj/directionCompile.ts` turns a stored body into a display
result using the compiled ingredient list.

Algorithm:

1. Scan `body` with `/#[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi`.
2. For each match, look up the UUID in the compiled ingredient list.
   - Found → a **chip segment** with `{ id, ingredient }`.
   - Not found → render literally as the raw `#uuid` text. The body is
     never mutated on read; this preserves intent across forks where a
     leaf removes an ancestor ingredient.
3. The chip's display text follows this format:
   - amount 0 or unit empty → `Ingredient`.
   - amount > 0, unit empty → `Ingredient (amount)`.
   - amount 0, unit present → `Ingredient (unit)` (e.g. `Salt (to taste)`).
   - both → `Ingredient (1 cup)`.
   - amount formatting reuses `formatAmount` so fractions and rounding
     (3 decimals) match the ingredient row.
4. The compile returns `{ compiled, tokens }` where `tokens` is an
   ordered list of `{ id, start, end, ingredient | null }` so renderers
   can split the body into text vs chip segments without re-running the
   regex.

The compile runs at every read site; the compiled value is never
persisted.

## Read sites

Three surfaces render compiled output instead of raw bodies:

1. **Public recipe view** — `src/lib/component/PublicRecipe.svelte`
   replaces `{direction.body}` with `<DirectionBody>`.
2. **`/mise` read-only display** — `DirectionRow.svelte`'s non-editing
   branch renders via `<DirectionBody>`.
3. **History / node-changes diff** — `formatDirectionChangeFull` in
   `src/lib/obj/recipeDiff.ts` compiles against the recipe's known
   ingredients so the diff view shows chips consistently.

## Display mask

The body is rendered through the IMask-based `DirectionMask` library
(`src/lib/obj/directionMask.ts`). Three entry points:

1. `formatDirectionBody(body, ingredients)` — pure transform that
   swaps `#<uuid>` tokens for `#<name>`. Use this anywhere a direction
   body needs to be displayed read-only.
2. `compileMaskedDirection(body, ingredients)` — structured compile
   into chip/text segments, used by renderers that want rich chip
   styling.
3. `DirectionMasked` / `createDirectionMask(opts)` — `IMask.Masked`
   subclass; binds via IMask's view layer when this kind of integration
   is needed (e.g. `use:directionMask` action).

In the editing form, the textarea itself is masked: when blurred it
shows `#Sugar`-formatted text, when focused it shows the raw `#<uuid>`
text the picker regex matches.

## Authoring UI

The `<textarea>` is the source of truth for the raw body. We layer on:

- A `bind:this` ref so the focus/blur handlers can swap the displayed
  value between `#<name>` (blurred) and `#<uuid>` (focused).
- A masked value expression: `value={textareaFocused ? draft.body :
  formatDirectionBody(draft.body, ingredients)}`. Svelte writes this
  to the DOM only when it changes (no flicker on each keystroke).
- A backspace handler that deletes a complete `#<uuid>` token when
  the caret sits at its end (existing behavior, preserved).
- The existing `<IngredientPicker>` driven by the `#`-trailing-text
  regex; the picker inserts raw `#<id>` into the textarea.

A fully `contenteditable` approach was rejected: it drags in IME
composition bugs, paste sanitization, and copy/paste edge cases that
are not worth solving here.

## `#`-trigger ingredient picker

Typing `#` in a direction textarea opens a self-managed dropdown
anchored under the caret. The list source is the **compiled**
ingredients (the same list the editing view already exposes), not just
the leaf's adds — a direction can therefore reference any ingredient on
the recipe, including ancestors.

Behavior:

- Opens on `#`, closes on Escape, click outside, or any non-`#`
  modifier that isn't a navigation key.
- Filter is the text after the last `#` and before the next whitespace;
  `sug` matches "Sugar". Empty filter shows all ingredients.
- Each item renders as `Ingredient (amount unit)` so the author knows
  what they're picking.
- Keyboard: ↓/↑ move, Enter selects, Tab inserts and adds a trailing
  space if not already present.
- On select, insert `#<id>` at the caret with a trailing space if the
  next character isn't whitespace.

The picker lives in `IngredientPicker.svelte`, used by both the
edit-direction form (`DirectionRow`) and the add-direction form
(`Recipe.svelte`). It prop-drills `ingredients` and emits `onPick(id)`.

The dropdown uses the self-managed pattern documented in
`svelte-ui-patterns` — no `bits-ui` Popover — to avoid the
interaction conflicts the unit-autocomplete work had.

## Editing references

With the textarea itself masked, the editing flow no longer has a
chip overlay. Two paths to edit a reference:

- **Replace**: place the caret right after the `#<uuid>` token (no
  whitespace between), type `#`, and pick a different ingredient from
  the picker. The picker's `replace #`+filter logic rewrites the
  token in place.
- **Delete**: keep the caret right after the `#<uuid>` token (no
  whitespace) and press Backspace once. The keyboard handler strips
  the token, including the leading `#`, in a single keystroke.

Backspace handling: if the caret sits immediately after `#uuid` (no
whitespace between) and the user presses Backspace once, the whole
token deletes. Use `selectionStart` to detect caret-at-end-of-token;
on Backspace at that position, strip the match (and the leading `#`)
from the body.

## Notes tab

The Note tab in the add/edit form keeps its own textarea but is **not**
compiled — notes stay plain text. The compile + picker only apply to
the Details tab body. This is a deliberate simplification: notes are
author commentary, not recipe content.

## Editing flow

`DirectionRow` already manages `draft = { ...direction }` during edit.
The body field stays `bind:value={draft.body}`; we layer on:

- A `<textarea>` with `bind:value={draft.body}` and a `textareaRef`.
- A chip overlay `<div>` driven by `compileDirection(draft.body,
  ingredients)` via `$derived`.
- `<IngredientPicker>` opens via a `$state` flag triggered by the
  textarea's `oninput` matching `/#[^\s]*$/`.
- `onUpdate` still sends `{ ...draft }` — no API change.

The add-direction form in `Recipe.svelte` gets the same overlay +
picker; new directions are saved through the existing
`doAddDirection` path.

## Edge cases

- **Unknown ingredient id** — render raw `#uuid` text. Survives forks
  where an ancestor ingredient is removed in the leaf.
- **Multiple `#` in one body** — each match is independently compiled;
  order preserved.
- **Adjacent tokens** — `#[0-9a-f-]{36}` restricts matches to UUIDs,
  so `#a#b` cannot form a greedy match.
- **Edge of textarea** — chips overlay is `pointer-events: none`; only
  the transparent click layer receives pointer events. Caret placement
  uses the textarea's `getBoundingClientRect()` for the character
  offset.
- **Amount/unit formatting parity** — reuses `formatAmount`, so
  fractions, mixed numbers, and 3-decimal rounding match the
  ingredient row. Amount changes after chip insertion are picked up on
  next compile — no stale state.
- **Round-trip safety** — saved body always contains `#<uuid>` tokens;
  load + recompile is idempotent.

## Files

- `src/lib/obj/directionMask.ts` — IMask-based mask library:
  `formatDirectionBody`, `compileMaskedDirection`, `DirectionMasked`,
  `createDirectionMask`. Plus unit tests in `directionMask.test.ts`
  (server-side) and `directionMask.svelte.test.ts` (DOM/browser).
- `src/lib/obj/directionCompile.ts` — thin re-export of
  `compileMaskedDirection` for backwards compatibility with the
  original compile layer. New callers should import from
  `directionMask` directly.
- `src/lib/obj/directionCompile.test.ts` — covers the legacy
  compile output (kept for backwards compat); runs through the
  re-export, no test changes needed.
- `src/lib/action/directionMask.ts` — `use:directionMask` Svelte
  action that wires IMask directly to a `<textarea>`. Includes
  browser-side tests in `directionMask.svelte.test.ts`.
- `src/lib/component/DirectionBody.svelte` — read-only renderer.
  Uses `compileMaskedDirection` for rich chips; the textarea
  swap mechanism is in the editing form, not here.
- `src/lib/component/DirectionRow.svelte` — editing textarea now
  swaps its own DOM value via focus/blur handlers that call
  `formatDirectionBody` from the mask library. Drop-in replacement
  for the chip-overlay approach.
- `src/lib/component/Recipe.svelte` — same swap in the inline
  add-direction form. Uses `formatDirectionBody` from the mask
  library; no overlay div.
- `src/lib/component/PublicRecipe.svelte` — unchanged: already
  rendered via `<DirectionBody>`.
- `src/lib/obj/recipeDiff.ts` — `formatDirectionChangeFull`
  imports `compileMaskedDirection` from `directionMask` (the
  compile API is identical to the legacy `compileDirection`,
  so the call sites are unchanged).
- `tests/e2e/helpers/page-utils.ts` — adds `getIngredientPicker`,
  `pickIngredientFromDirection` helpers.
- `tests/e2e/direction-ingredient-ref.e2e.ts` — the chip-overlay
  Remove/Change affordances are gone, so the e2e tests that
  click them need to use keyboard flows (Backspace to delete,
  pick a new ingredient to replace). The "save and reload, see
  the formatted reference" tests stay green because they assert
  on the read-only view, which still uses `<DirectionBody>`.
- `tests/e2e/recipe-edit-changes.e2e.ts` — existing direction tests
  stay green; fixtures that asserted on raw bodies get updated where
  bodies now contain `#uuid` tokens.
- `docs/features/README.md` — register this feature doc.
