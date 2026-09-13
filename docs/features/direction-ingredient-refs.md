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

## Authoring UI

Editing uses an **overlay rendering** approach. The `<textarea>` stays
the source of truth for the body; a non-editable `<div>` is layered on
top with identical typography, where `#uuid` tokens render as inert
visual chips. When the textarea is focused the overlay hides so the
author sees raw `#uuid` text.

Keeping the overlay in sync:

- Mirror `font-family`, `font-size`, `line-height`, `padding`,
  `white-space: pre-wrap`, and `word-break: break-word` exactly.
- The overlay is `pointer-events: none`.
- Mirror scroll: `overlay.scrollTop = textarea.scrollTop`.
- A transparent click layer over each chip focuses the textarea and
  places the caret at the chip's start offset using
  `textarea.setSelectionRange`.

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

## Chip behavior in the overlay

When the textarea is **not focused**, each chip in the overlay exposes
two affordances:

- **Change…** reopens the picker with the chip's id shown as the
  current link. Picking a different ingredient rewrites `#oldId` →
  `#newId` in the body. Picking the same ingredient is a no-op.
- **Remove** rewrites `#<id>` to empty string and trims one trailing
  space, e.g. `Add #uuid to the bowl.` → `Add to the bowl.`.

Mobile uses long-press on a chip to surface the same Change/Remove
menu. Desktop shows them on hover; keyboard users get the menu via
focus + Enter on a chip's hidden button (defer to a follow-up if
keyboard ergonomics prove rough).

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

- `src/lib/obj/directionCompile.ts` — new: `compileDirection` +
  helpers.
- `src/lib/obj/directionCompile.test.ts` — new: unit tests.
- `src/lib/component/DirectionBody.svelte` — new: non-interactive
  renderer for read-only sites.
- `src/lib/component/IngredientPicker.svelte` — new: self-managed `#`
  dropdown.
- `src/lib/component/DirectionRow.svelte` — adds overlay + picker when
  editing; renders via `<DirectionBody>` when not. Takes a new
  `ingredients` prop.
- `src/lib/component/Recipe.svelte` — passes compiled ingredients into
  `DirectionRow`; adds picker to the add-direction form.
- `src/lib/component/PublicRecipe.svelte` — replaces raw
  `{direction.body}` with `<DirectionBody>`.
- `src/lib/obj/recipeDiff.ts` — `formatDirectionChangeFull` compiles
  against the recipe's known ingredients so history shows chips too.
- `tests/e2e/helpers/page-utils.ts` — adds `getIngredientPicker`,
  `pickIngredientFromDirection` helpers.
- `tests/e2e/direction-ingredient-ref.e2e.ts` — new: end-to-end covering
  type `#`, pick Sugar, save, reload public page, see "Sugar (1 cup)".
- `tests/e2e/recipe-edit-changes.e2e.ts` — existing direction tests
  stay green; fixtures that asserted on raw bodies get updated where
  bodies now contain `#uuid` tokens.
- `docs/features/README.md` — register this feature doc.
