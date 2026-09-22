# Plan: replace hand-rolled components with shadcn-svelte

`components.json` is already configured (`style: vega`, `iconLibrary: lucide`, baseColor `neutral`). The first wave of registry items is installed (`button`, `button-group`, `command`, `dialog`, `input`, `input-group`, `popover`, `separator`, `tabs`, `textarea`). Twenty-four files in `src/lib/component/` are still hand-rolled. This plan replaces them in waves, smallest blast radius first.

## Guiding principles

- **Verify against the existing test suite after each wave.** Run `just agent-e2e` (or the manual `DATABASE_URL=... pnpm exec playwright test` command) against preview before and after each wave. Tests pass on preview today — the contract is "don't regress them."
- **Don't touch behaviour, only the implementation.** The user-facing affordances, `data-testid` attributes, and accessible names stay identical. Existing e2e selectors keep working.
- **One wave = one PR-sized commit.** Each wave is independently revertable.
- **Skip waves whose blast radius exceeds value.** Listed at the end.

## Wave 1 — trivial icon and file deletions ✅ DONE (2026-09-21)

**Components replaced:** `Spinner.svelte`, `NoteIcon.svelte`, `GrainOfSaltTitle.svelte`, inline SVGs in `MobileFloatingButtons.svelte` and `RecipeList.svelte`, 📝 emoji in `RecipeHistory.svelte`.

**Changes:**

- Replace `Spinner.svelte` body with `<Loader2 class="animate-spin ..." />` from `@lucide/svelte`. Delete the file's `<style>` block; the size prop maps to `class="size-{...}"`.
- Replace `NoteIcon.svelte`'s inlined SVG with `<NotebookPen />` (or `FileText`) from `@lucide/svelte/icons/notepad-text`. Keep the same `width="14" height="14"` defaults via the lucide `class="h-3.5 w-3.5"` convention.
- Inline the title markup from `GrainOfSaltTitle.svelte` into the single caller (`src/routes/+page.svelte:11`). Delete the file.
- `MobileFloatingButtons.svelte`: replace the three inline SVGs with `<Search>`, `<Menu>`, `<X>` from `@lucide/svelte`.
- `RecipeList.svelte`: replace the two expand/collapse SVGs and the chevron with `<Expand>`, `<Minimize2>`, `<ChevronRight>`.
- `RecipeHistory.svelte`: replace 📝 with `<NotebookPen class="h-3 w-3" />`.

**Exit criteria:** `pnpm run check`, `pnpm run lint`, and `tests/e2e/` all green against preview. Visual diff: icons should look identical to the current state.

## Wave 2 — install missing registry items, swap form/dialog primitives ✅ DONE (2026-09-21)

Modal.svelte deleted. Recipe.svelte's Rename + Fork modals now use
`<Dialog.Root bind:open>` + `<Dialog.Content>` + `<Dialog.Header>` +
`<Dialog.Title>` + `<Dialog.Footer>`. Inner buttons swap raw `<button
class="btn-amber">` for `<Button>` (default + outline variants). This
unintentionally ticked Wave 1's button-raw-class sweep off the list for
the two Modal call sites — the other `btn-amber` usages remain (see
Wave 8 badge/icon pass).

**`Tabs.svelte` DEFERRED.** The shadcn `Tabs.Root` API
(`<Tabs.Root bind:value><Tabs.List><Tabs.Trigger value="x">` +
`<Tabs.Content value="x">`) couples the trigger to its content as a
child snippet. The existing 4 call sites use a different pattern:
`<Tabs tabs={[…]} selected={x} onchange={…}>` followed by
`{#if x === 'details'} ... {:else} ... {/if}` external to the component.
Migrating to shadcn Tabs would require either (a) a thin wrapper that
hides the shadcn API — pointless since Bits UI already gives us the
labelled-button-group for free — or (b) inlining each form's body as
`Tabs.Content` snippets, which is a much bigger refactor with no UX win.
Leave the 51-line hand-rolled `Tabs.svelte` in place; it's a
deliberately simpler API for this call pattern.

**Components added:** `tabs` (registry), `alert-dialog` (registry).

**Components replaced:** `Modal.svelte`, `Tabs.svelte`.

**Changes:**

- `pnpm dlx shadcn-svelte@latest add tabs alert-dialog`. These use Bits UI primitives already in the dependency tree.
- `Modal.svelte` (used in `Recipe.svelte` for Rename + Fork): swap to `<Dialog.Root>`, `<Dialog.Content>`, `<Dialog.Header>`, `<Dialog.Title>`, `<Dialog.Footer>`. The two `bind:showModal` props become `<Dialog bind:open>`. Build header snippet into `<Dialog.Title>`. Move the cancel/submit button row into `<Dialog.Footer>` with `<Button>` components. Delete `Modal.svelte`.
- `Tabs.svelte`: re-export the installed `Tabs.Root`/`Tabs.List`/`Tabs.Trigger` from a thin `Tabs.svelte` (keep `id`/`label`/`selected`/`onchange` props so the two call sites in `IngredientRow.svelte:186` and `DirectionRow.svelte:450` don't change). Future cleanup: delete `Tabs.svelte` and update the two call sites directly.

**Exit criteria:** `tests/e2e/recipe-edit-changes.e2e.ts` and `tests/e2e/recipe-create.e2e.ts` still green (they exercise the rename modal indirectly via other code paths; if a regression appears, fix in this wave). `pnpm run check` clean.

## Wave 3 — `window.confirm` → `AlertDialog` ✅ DONE (2026-09-21)

Installed `alert-dialog` registry. Both row components now use
`<AlertDialog.Root bind:open={confirmRemoveOpen}>` with a destructive
Action button. The Action button carries `data-testid="confirm-remove"` so
the e2e tests can locate it without scoping to a non-existent
`role="alertdialog"` (Bits UI's AlertDialogContent doesn't auto-set that
role, and adding it would fight shadcn's data-state styling hooks).

**Test contract change:** the two Remove tests in
`tests/e2e/recipe-edit-changes.e2e.ts` (ingredient + direction) used to
rely on `page.on('dialog', accept)` to auto-accept the browser confirm.
After the swap, that handler is inert (AlertDialog isn't a native dialog)
and the tests had to gain a `getByTestId('confirm-remove').click()` step
between the menu click and `clickPageSave`. The other two test files
that register the dialog handler (`direction-ingredient-ref.e2e.ts`,
`recipe-substitute.e2e.ts`) never actually click Remove — the handler
there was always defensive, so it's now doubly inert but harmless.

**Components replaced:** the two `window.confirm(...)` calls in `IngredientRow.svelte:137` and `DirectionRow.svelte:123`.

**Changes:**

- Add a `confirmRemove` state in each row component (`$state(false)`).
- Replace `window.confirm(...)` with setting the state to `true`. The actual remove logic moves into a handler that runs after the user confirms.
- Add a `<AlertDialog.Root bind:open={confirmRemove}>` at the bottom of each row's edit/read blocks. Body: title "Remove ingredient?" / "Remove this direction?", description with the name or generic text, `<AlertDialog.Footer>` with Cancel + destructive "Remove" button.

**Exit criteria:** the existing `recipe-delete.e2e.ts` (or whichever deletes rows) still passes. Manual: navigate to a recipe, edit an ingredient, click Remove, see styled alert dialog with Cancel/Remove buttons instead of a browser confirm.

## Wave 4 — slide-out side panels → `Sheet` ✅ DONE (2026-09-21)

Installed `sheet` registry. Both `NoteSidebar.svelte` and
`SubstitutesPanel.svelte` now use `<Sheet.Root side="right">` +
`<Sheet.Content>`. The hand-rolled `<svelte:window onkeydown={Escape}>` +
outside-click backdrop were dropped — Bits UI's `EscapeLayer` and
`DismissibleLayer` provide both automatically. `Sheet.Header` /
`Sheet.Title` replace the amber-background `<header>` band; the
`<blockquote>` + textarea / substitute list now lives in a plain
`<div class="flex-1 overflow-y-auto">` since shadcn's `Sheet.Content`
already provides the panel chrome.

**Test contract changes:**
- `data-testid="substitutes-close"` is preserved on the header's X
  button (Sheet's built-in close button is disabled via
  `showCloseButton={false}` so the testid sticks).
- `data-testid="substitutes-backdrop"` is **gone** — shadcn's overlay
  is `<div data-slot="sheet-overlay">` and can't carry a custom testid
  without overriding `sheet-content.svelte`. The test was updated to
  click `[data-slot="sheet-overlay"]` instead, which still exercises
  the same user-visible behaviour (clicking the dimmed area closes).
- `data-testid="note-confirm"` / `"note-delete"` are preserved on the
  `<Button>` elements.

**Changes:**

- `pnpm dlx shadcn-svelte@latest add sheet`.
- `NoteSidebar.svelte`: rewrite as a `<Sheet.Root side="right">` with `<Sheet.Header>` (title "Edit note" or "Note"), `<Sheet.Description>` (the change kind · changeType label), `<Sheet.Body>` (the blockquote + textarea in edit mode / note text in read mode), `<Sheet.Footer>` (Confirm / Delete / Cancel buttons). The backdrop click and Escape close behaviour come free. Keep the `SidebarChange` type and the `onclose`/`onsave`/`ondelete` props so callers don't change.
- `SubstitutesPanel.svelte`: same pattern. The header has the row label instead of a description. Body is the list of `substitute-entry` articles. Keep `byRowId`/`selection`/`onclose` props.

**Exit criteria:** `tests/e2e/recipe-edit-changes.e2e.ts` (if it covers note opening) and any descendant-substitute test pass. Visual: slide animation matches what shadcn-svelte's `Sheet` ships with (default is to leave alone, theme inherits from vega).

## Wave 5 — context menu → `DropdownMenu` ✅ DONE (2026-09-21)

Installed `dropdown-menu` registry. `ContextMenu.svelte` is now a
`<DropdownMenu.Root>` wrapper. The `items` array shape is unchanged.

**Dropped (test-visibility hack + hand-rolled behaviour that Bits UI now
provides):**
- The `getBoundingClientRect` positioning math
- The hand-rolled outside-click listener
- The hand-rolled Escape keydown listener
- The `style="position: fixed; left: ${x}px; top: ${y}px"` inline
  positioning
- The `setTimeout(forceHide)` race that kept the menu visible for tests

**Preserved:**
- `aria-haspopup="menu"`, `aria-label` on the trigger
- `getByRole('menuitem', { name })` continues to match
  (Bits UI's `<div role="menuitem">` still resolves via ARIA)
- All three call sites (IngredientRow, DirectionRow, NodeChanges)
  unchanged

**Test contract change:**
- `public-recipe-link-copy.e2e.ts` was clicking the trigger twice to
  close then reopen the menu between item selections. With Bits UI's
  DismissibleLayer, clicking the trigger while the menu is open is
  ambiguous (the content overlay may intercept). Replaced those
  double-clicks with `page.keyboard.press('Escape')` to close, then
  click trigger to reopen.

**Changes:**

- `pnpm dlx shadcn-svelte@latest add dropdown-menu`.
- Rewrite `ContextMenu.svelte` as a `<DropdownMenu.Root>` wrapper. The `items` array stays the same shape (`{ label, onSelect, disabled?, danger? }`) and is mapped to `<DropdownMenu.Item>` rows. The `danger` flag maps to `<DropdownMenu.Item class="text-destructive focus:text-destructive">`. Disabled items use the `<DropdownMenu.Item disabled>` variant.
- The trigger button becomes `<DropdownMenu.Trigger>` (a `<Button variant="ghost" size="icon">` with a `<MoreVertical />` icon from lucide). The ⋮ glyph stays or gets replaced with `<MoreVertical>`.
- Drop the 155 lines of `position: fixed` math and the global keydown capture — Bits UI's `DropdownMenu` does flip-on-overflow and outside-click automatically. This is the highest-value swap: it eliminates the entire class of "menu item is outside the viewport" e2e timeouts (the bug called out in `svelte-ui-patterns` skill memory).

**Exit criteria:** every test that uses the kebab menu still passes. Smoke test: open a row's menu near the bottom of the viewport — it should flip above the trigger (Bits UI does this by default; the current implementation has a hand-rolled flip in lines 96-102 that we're replacing).

## Wave 6 — autocomplete → Combobox (deferred permanently — **not migrated**)

**Components left hand-rolled:** `Autocomplete.svelte` +
`AutocompleteDropdown.svelte` + `IngredientPicker.svelte` +
`UnitAutocomplete.svelte`.

**Why we did not migrate:** the hand-rolled autocomplete has four
non-standard behaviours that the shadcn Combobox registry item
(`<Popover>` + `<Command>`) does not ship out of the box, and reproducing
all four in a wrapper would mean hand-writing almost everything that
makes Combobox worth using in the first place.

1. **Tab / Shift+Tab cycles options.** Tab is "next option" and
   Shift+Tab is "previous option"; Enter is the only activation key.
   This is a listbox-as-form-control pattern, not the ARIA combobox
   pattern. shadcn's Combobox renders `<input role="combobox">` with a
   listbox popup that uses ArrowUp/Down for navigation and Tab to
   *close the popup and move focus to the next form field*. Rewiring
   Tab inside a wrapper requires intercepting the keydown and either
   re-implementing listbox navigation or calling `e.preventDefault()`
   and stepping the highlighted item manually — at which point the
   Command component is just rendering buttons we'd be replacing.

2. **Global `document.addEventListener('keydown', ..., true)` capture.**
   The listbox fires navigation on keys captured at the document level
   so it works while focus is inside a `<textarea>` (the
   `IngredientPicker` use case, and the same pattern the unit
   autocomplete would need if it ever lived inside a textarea).
   shadcn's Combobox only handles keydown while focus is on its
   `<Command.Input>`. For a textarea-anchored picker this is a real
   regression.

3. **`onExactMatch` callback for unit auto-canonicalisation.**
   `UnitAutocomplete.svelte` calls `onExactMatch(search, items)` when
   the typed value matches a known unit, and the handler rewrites the
   canonical form (`tsp` → `teaspoon`, `cups` → `cup`,
   `TABLESPOONS` → `tablespoon`). This is exercised by
   `tests/e2e/unit-autocomplete.e2e.ts` and is a real UX feature,
   not an accident. Combobox has no equivalent hook; the wrapper would
   need to subscribe to `Command.Input`'s value and call the callback
   when the input matches an item's label or value.

4. **`role="listbox"` + `aria-label="Unit"` test contract.**
   `tests/e2e/unit-autocomplete.e2e.ts` selects the input via
   `getByRole('textbox', { name: 'Unit' })` and the dropdown via
   `getByRole('listbox')`. shadcn's Combobox renders
   `<input role="combobox">` and `<div role="dialog">` (not listbox).
   Migrating would require either changing every test selector (the
   test contract is the e2e guarantee — see `grain-of-salt-svelte-workflow`
   skill memory: "data-testid/aria-label are the e2e test contract,
   preserve them") or building a custom wrapper that re-exposes the
   old ARIA semantics — at which point the wrapper is bigger than the
   thing it wraps.

**Decision:** leave the hand-rolled `Autocomplete*` family in place. The
plan's option to "leave the hand-rolled autocomplete and document why"
applies. If a future caller needs a real Combobox (typed-search-with-
suggestions, no Tab navigation, ArrowDown/Up navigation, single-select
value), that caller can use the registry `<Combobox>` directly without
retrofitting the existing Autocomplete.
The migration:

- Wrap `Combobox` in a new `Autocomplete.svelte` that owns the input filter state and exposes the existing `{ items, value, onchange, onExactMatch, placeholder }` props.
- Keep `AutocompleteDropdown.svelte`'s keyboard handling for the Tab-cycling behaviour, or move the logic into the wrapper.
- Delete the self-managed positioning math (lines 162-195 of `AutocompleteDropdown.svelte`).

**Exit criteria:** `tests/e2e/unit-autocomplete.e2e.ts` and `tests/e2e/direction-ingredient-ref.e2e.ts` still pass. Verify the `tsp` → `teaspoon` auto-canonicalisation still fires by typing `tsp` in a unit field and checking the model.

## Wave 7 — sidebar collapse → Collapsible + Sheet

**Components added:** `collapsible` (registry).

**Components replaced:** the sidebar rendering in `src/routes/mise/+layout.svelte` (currently `aside` + collapse toggle button + `inert` attribute).

**Changes:**

- On desktop: wrap the sidebar's `<aside>` content in a `<Collapsible.Root bind:open={!sidebarCollapsed}>`. The toggle button calls `sidebarCollapsed = !sidebarCollapsed`.
- On mobile: wrap the sidebar in a `<Sheet.Root>` triggered by `MobileFloatingButtons`. When opened, sheet renders the sidebar overlay.

The current implementation already does both modes in a single `<aside>` with media-query-driven CSS. The migration keeps the visual layout but uses the appropriate primitive for each breakpoint. `inert={sidebarCollapsed}` gets replaced by either `Collapsible` (desktop) or Sheet's built-in open state (mobile).

**Exit criteria:** `tests/e2e/recipe-list.e2e.ts` (if it exists) and any test that asserts the recipe list is visible after auth still pass. Manual: verify mobile vs desktop behaviour via Playwright's `setViewportSize` switch.

## Wave 8 — Tooltips and badges (cleanup pass)

**Components added:** `tooltip`, `badge`.

**Components replaced:** `title="..."` attributes in `IngredientRow.svelte`, `DirectionRow.svelte`, `NodeChanges.svelte`; the four chip shapes in `IngredientRow.svelte:251-262`, `DirectionRow.svelte:511-522`, `RecipeHistory.svelte:62-66`, `NodeChanges.svelte:206-209`.

**Changes:**

- Tooltip: wrap each `<button title="...">` with `<Tooltip.Provider>` + `<Tooltip.Root>` + `<Tooltip.Trigger>` + `<Tooltip.Content>`. The `aria-label` stays. Title attribute removed.
- Badge: replace each inline `<span class="rounded-full bg-amber-100 ...">` with `<Badge variant="amber">` (custom variant added via `tailwind-variants` in `badge.svelte`). The "EDIT"/"ADD"/"SUB"/"REMOVE" history labels become `<Badge>` components keyed off `changeType`.

**Exit criteria:** visual snapshot of one recipe page stays identical (or close enough that the user accepts the cleanup).

## Skipped / explicitly out of scope

- `Recipe.svelte`, `PublicRecipe.svelte`, `NodeChanges.svelte`, `RecipeHistory.svelte`, `RecipeList.svelte`, `IngredientRow.svelte`, `DirectionRow.svelte`, `DirectionBody.svelte`, `GraphInitializer.svelte`, `RecipeNodeCard.svelte`, `RecipeGraph.svelte`. These are domain components (recipe rows, masked-body editing, history diffs, graph layout) — shadcn-svelte has no analogue.
- The `inert={sidebarCollapsed}` and `matchMedia('(max-width: 767px)')` breakpoint logic in `mise/+layout.svelte` stays for now — Wave 7 swaps it for Collapsible/Sheet but doesn't refactor the breakpoint.
- The `.btn-amber` global rule in `app.css` stays. The shadcn Button has a different visual treatment (neutral palette, not amber); some places intentionally want the amber (recipe-form Save/Cancel). Migration is opt-in per call site.
- Removing `Tabs.svelte` (the wrapper) — keep it as a thin shim until the two call sites migrate to `Tabs.Root` directly. Tracked in a future cleanup.

## Order of execution

1. Wave 1 (icons) — safe, visual only.
2. Wave 2 (Modal → Dialog) — DONE. Tabs swap deferred (API mismatch with current call pattern).
3. Wave 3 (AlertDialog) — DONE. Replaces `window.confirm` for Remove actions.
4. Wave 4 (Sheet) — DONE. NoteSidebar + SubstitutesPanel both use Sheet.Content.
5. Wave 5 (DropdownMenu) — DONE. Big code reduction, e2e selector contract held via ARIA.
6. Wave 6 (Combobox) — DEFERRED PERMANENTLY. Four non-standard behaviours (Tab nav, document-level keydown capture for textarea anchors, onExactMatch callback, listbox role) cannot be reproduced by shadcn's Combobox without writing a wrapper bigger than the thing it wraps. Hand-rolled Autocomplete* family stays.
7. Wave 7 (Collapsible + Sheet sidebar) — depends on Wave 4 for Sheet.
8. Wave 8 (Tooltip, Badge) — pure cleanup pass, can be split across multiple commits.

Each wave is independent — pause for review after each one.
