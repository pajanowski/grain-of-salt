# Plan: /mise landing — dashboard (B) + onboarding (C)

> Status: **Draft, not started.** Captured for later. Two phases: B (dashboard)
> first, then C (onboarding) layered on top.

## Background

`/mise` currently renders an empty main pane — just the sidebar with recipe
list, create/import buttons, and auth footer. The right side has nothing.

- **Empty-state for first-time users** is jarring: sidebar with no recipes and
  no guidance.
- **Returning users** have no at-a-glance shortcut to recent work — they
  have to scan the tree.

## Resolved design questions

| # | Question | Decision |
|---|----------|----------|
| B1 | "Last edited" semantics | Most recent write across the **whole chain** (root + descendants). The leaf that owns the timestamp is what we link to. |
| B2 | Fork count semantics | Direct children only. |
| B3 | Click target | Jump to the **latest leaf**, not the root. |
| B4 | Row cap & sort | Cap **5**, sort **descending by lastEditedAt**. |
| C6 | Where does the flow live? | **Modal on `/mise`**, not a new route. |
| C7 | "Guided" UX | **Tooltips only** — no scripting, no auto-fill. |
| C8 | Seed sample recipes | **Absorb** into the onboarding modal. Remove from `/me`. |
| C9 | Completion | **Silent** transition — modal hides, dashboard takes over (when ≥1 recipe). |
| C10 | Scope | Minimal: **one modal, three options, one dismiss key**. |

## Phase 1 — Dashboard (B)

### 1.1 Schema migration

`supabase/migrations/<timestamp>_add_last_edited_at.sql`

- Add `last_edited_at timestamptz not null default now()` to `recipe_nodes`.
- Backfill is automatic via the default.
- Down migration drops the column.

### 1.2 Touch the column on writes

`src/lib/server/bo/recipenodesbo.ts`

- In `updateRecipeNode` (and any other content-mutating path — audit before
  coding), set `lastEditedAt = now()` on the **edited node**, not the parent
  chain. The chain's most-recent write is computed at read time (1.3).
- Grep all callers of `db.update(recipeNodes)` to make sure none bypass
  this; bring them under the same helper.

### 1.3 New BO function: `getRecipeDashboard`

`src/lib/server/bo/recipenodesbo.ts`

```ts
export interface RecipeDashboardEntry {
  rootId: string;
  name: string;
  forkCount: number;        // direct children only
  lastEditedAt: Date;       // most recent write across root + descendants
  leafId: string;           // the node that produced lastEditedAt
}

export async function getRecipeDashboard(
  ownerId: string,
  limit = 5
): Promise<RecipeDashboardEntry[]>;
```

Implementation:

1. One query: pull `{ id, name, parentId, lastEditedAt }` for all nodes
   owned by `ownerId`.
2. Index by id.
3. For each root (`parentId === null`), compute `lastEditedAt` as
   `max(root.lastEditedAt, max(descendant.lastEditedAt))` and remember
   which descendant owns that max.
4. Count direct children per root.
5. Sort desc by computed `lastEditedAt`, slice to `limit`.

O(n) over the user's nodes — fine at current scale; revisit with a
materialized view if it ever isn't.

### 1.4 Loader

`src/routes/mise/+page.server.ts` (currently empty)

- Add `load` returning `{ dashboard: RecipeDashboardEntry[] }`.
- Calls `getRecipeDashboard` separately from the existing tree loader to
  keep the two reads decoupled.

### 1.5 Component: `<RecipeDashboard>`

`src/lib/component/RecipeDashboard.svelte`

- Heading: "Recent recipes" (copy decided at impl time).
- List of cards. Each card:
  - Recipe name (bold)
  - `· N fork(s)` (omit when 0; singular when 1)
  - Relative time ("2 hours ago")
  - Link to `/mise/recipes/{leafId}`
- Empty sub-state when `dashboard.length === 0` is **not** handled here —
  that's the onboarding phase's job.

Styling: matches the existing mise frame (stone palette, `btn-amber` style).
No new design tokens.

### 1.6 Mount on /mise

`src/routes/mise/+page.svelte`

- Replace empty `<script>` with dashboard reader.
- Render `<RecipeDashboard>` in the main pane, centered max-width
  container similar to `/me`.
- Sidebar remains the source of truth for navigation; dashboard is the
  at-a-glance shortcut.

### 1.7 Tests

**Unit** — `recipenodesbo.test.ts`, new `describe('getRecipeDashboard')`:

- Empty owner → `[]`
- Single root, no forks → `forkCount: 0`, `leafId === rootId`
- Root with N direct forks; latest descendant write wins `lastEditedAt`
- Sort order is descending by `lastEditedAt`
- Respects `limit`

**E2E** — new file `tests/e2e/recipe-dashboard.e2e.ts`:

- Create 2 recipes, edit one twice, navigate to `/mise`, assert the
  more-recently-edited appears first.
- Assert card click navigates to the **latest leaf** (not root).
- Assert `forkCount` text reflects direct children only.
- Assert dashboard is **not** rendered when zero recipes exist (that's C's
  job).

**Page-utils** — add `getDashboardCard(page, name)`.

---

## Phase 2 — Onboarding (C)

Built after Phase 1 ships.

### 2.1 Component: `<OnboardingModal>`

`src/lib/component/OnboardingModal.svelte`

Modal rendered on `/mise` when `data.recipeTree.length === 0 && !dismissed`.

Three choices:

1. **Create from URL** — opens the existing sidebar Import form (focuses
   the input, scrolls sidebar into view on mobile).
2. **Start blank** — focuses the existing sidebar Create Recipe input.
3. **Seed sample recipes** — calls `/mise/api/seed`.

Single-step modal. No scripted sequence. Per question 7(a): tooltips not
scripting.

Dismissal:

- `localStorage` key `grain-of-salt:onboarding-dismissed` set on explicit
  "Skip" click.
- Implicit dismissal: when user creates their first recipe, the modal
  auto-hides.
- No "Show again" affordance — keep the door closed for now.

### 2.2 Mount on /mise

`src/routes/mise/+page.svelte`

- Render `<OnboardingModal>` when `recipeTree.length === 0`.
- Dashboard (Phase 1) renders when `recipeTree.length > 0`.
- The two never co-render.

### 2.3 Remove /me seed CTA

`src/routes/mise/me/+page.svelte`

- Drop the `{#if data.recipeCount === 0}` block that calls `seedRecipes`.
- Underlying `/mise/api/seed` endpoint **stays** — it's now invoked from
  the onboarding modal.

### 2.4 Tests

**E2E** — new file `tests/e2e/onboarding.e2e.ts`:

- Fresh user, navigate to `/mise`, assert modal is visible.
- Click "Skip", assert modal hidden, assert `localStorage` key set.
- Reload, assert modal stays hidden.
- Create a recipe via sidebar, navigate back to `/mise`, assert modal
  hidden, dashboard NOT shown (only one recipe, but dashboard still
  renders it).

**Unit** — none; UI state machine driven by props + localStorage.

---

## Phase 3 — Documentation

- `docs/features/recipe-dashboard.md` — one-paragraph summary, behaviour
  bullets, Files footer (per AGENTS.md).
- `docs/features/onboarding.md` — same shape.
- Register both in `docs/features/README.md`.
- Update `docs/overview.md` if it mentions "blank home page".

---

## Verification gates (after each phase)

- `pnpm run check`: baseline 8 errors / 8 warnings preserved (no new type
  errors).
- `pnpm run test:unit -- --run`: 181/183 floor maintained; +new passing
  tests; the two pre-existing `note: null` failures stay as-is.
- `pnpm exec playwright test`: full suite green.
- Preview lifecycle: `just build && just preview` after each
  schema/BO/loader change; `fuser -k 4173/tcp` to reap orphans before
  restarting.
- Prettier clean on every touched file.

---

## Out of scope (explicit)

- Thumbnails, image upload, image rendering.
- "Favorites" or starring.
- Real onboarding analytics / funnel tracking.
- Animated tooltips or scripted guidance.
- "Recently viewed" list (would need an access-log table; defer).
- Editing the public recipe page's 404 styling.
- Mobile-specific onboarding redesign (the modal works on mobile; no
  bespoke layout).

---

## Risk / reversibility

- Schema migration is additive (new column with default). Rollback is
  `ALTER TABLE DROP COLUMN`.
- BO function is new; no existing call paths change behavior.
- Removing the `/me` seed CTA is a UX change, not a behavior change — the
  endpoint stays. If users complain, the button is one `+page.svelte`
  patch away from being restored.

---

## Order of execution

1. Schema migration + write-path bump.
2. `getRecipeDashboard` BO + unit tests.
3. `<RecipeDashboard>` component + page-utils helper.
4. `+page.server.ts` loader + mount on `/mise/+page.svelte`.
5. Dashboard e2e tests.
6. Phase 1 verification gates.
7. `<OnboardingModal>` + mount + remove `/me` CTA.
8. Onboarding e2e tests.
9. Phase 2 verification gates.
10. Docs (Phase 3).

Each step lands independently; nothing blocks except the BO function on
the schema column existing.

---

## Files touched (final)

### Phase 1
- `supabase/migrations/<timestamp>_add_last_edited_at.sql` (new)
- `src/lib/server/bo/recipenodesbo.ts` — write-path bump, new function
- `src/lib/server/bo/recipenodesbo.test.ts` — unit tests
- `src/routes/mise/+page.server.ts` — loader
- `src/routes/mise/+page.svelte` — mount
- `src/lib/component/RecipeDashboard.svelte` (new)
- `tests/e2e/helpers/page-utils.ts` — `getDashboardCard`
- `tests/e2e/recipe-dashboard.e2e.ts` (new)

### Phase 2
- `src/lib/component/OnboardingModal.svelte` (new)
- `src/routes/mise/+page.svelte` — modal mount
- `src/routes/mise/me/+page.svelte` — remove seed CTA
- `tests/e2e/onboarding.e2e.ts` (new)

### Phase 3
- `docs/features/recipe-dashboard.md` (new)
- `docs/features/onboarding.md` (new)
- `docs/features/README.md` — register both
- `docs/overview.md` — update if needed
