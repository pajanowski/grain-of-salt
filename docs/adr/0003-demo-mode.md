# ADR 0003 — Demo Mode

## Status
Proposed

## Context

A visitor at `demo.grainofsalt.app` must be able to explore the full app UI without
creating an account or touching the real Supabase database. They can create, rename,
fork, and delete recipes. All state lives in the browser and is seeded from static
data on first visit. The experience is indistinguishable from the production app
from the user's perspective.

Constraint: **one codebase**, no build fork, no separate deployment artifact. The app
morphs at boot based on the hostname.

## Decision

Two implementations of a `RecipeStore` interface — a server-side Supabase adapter
and a client-side in-memory adapter — fronted by a single set of dispatch
functions. SSR in demo mode returns a stub Supabase client and empty data; the
client mounts a Svelte writable store and components subscribe to it.

### 1. Detection — `src/lib/demo-init.ts`

```ts
// Client-side only
export const isDemoMode =
  typeof window !== 'undefined' &&
  (window.location.hostname.startsWith('demo.') ||
    import.meta.env.VITE_DEMO_MODE === '1');

// Server-side only (no window, no Vite env)
export function isDemoHost(hostname: string): boolean {
  return hostname.startsWith('demo.');
}
```

Client and server use disjoint detection paths. `import.meta.env` is Vite's
client-side env access; `process.env.VITE_DEMO_MODE` would crash the browser
bundle. Defense in depth: client-side demo requires **both** the `demo.`
hostname and the env flag, so a misconfigured env var on prod cannot silently
activate demo mode.

### 2. Store interface — `src/lib/recipe-store.ts`

```ts
export interface RecipeStore {
  list(): Promise<RecipeSummary[]>;
  get(id: string): Promise<RecipeTree | null>;
  create(name: string): Promise<{ id: string }>;
  rename(id: string, name: string): Promise<void>;
  fork(id: string): Promise<{ id: string }>;
  remove(id: string): Promise<void>;
  saveNode(nodeId: string, changes: NodeChanges): Promise<void>;
}

export function getRecipeStore(): RecipeStore { /* server vs client impl */ }
```

`RecipeTree` and `RecipeSummary` are the existing shapes returned by
`getRecipeTree()` and the recipe list query — the demo adapter returns the same
shape so components are unchanged.

### 3. Dispatch functions — `src/lib/recipes.ts`

Mechanical rewrite of existing `api.*` call sites into typed functions:

```ts
export async function createRecipe(name: string) {
  return getRecipeStore().create(name);
}

export async function renameRecipe(id: string, name: string) {
  await getRecipeStore().rename(id, name);
}

// ...forkRecipe, deleteRecipe, saveNodeChanges, loadRecipeTree
```

Components import from `$lib/recipes`. The `api` instance is untouched — the
Supabase adapter wraps it internally, so production reads go through the same
axios pipeline as before.

Call-site changes are mechanical and bounded: ~6 functions, ~10–20 callers. Each
follows the pattern `await api.post('/api/save', { recipeName })` → `await
createRecipe(name)`. This refactor buys a testable seam, an explicit interface
contract, and removes the URL/body parsing logic the interceptor would otherwise
need.

### 4. Demo adapter — `src/lib/recipe-store.demo.ts`

Client-only. Backed by Svelte writables and localStorage; no module singleton,
no SSR coupling.

```ts
import { writable, get } from 'svelte/store';
import { SEED_RECIPES, SEED_NODES } from './demo-seed';

export const demoRecipes = writable<RecipeSummary[]>(loadOrSeed());
export const demoNodes = writable<Map<string, RecipeNode>>(new Map(SEED_NODES));

function loadOrSeed(): RecipeSummary[] {
  if (typeof localStorage === 'undefined') return SEED_RECIPES;
  const raw = localStorage.getItem('demo:recipes');
  if (raw) return JSON.parse(raw);
  localStorage.setItem('demo:recipes', JSON.stringify(SEED_RECIPES));
  return SEED_RECIPES;
}

function persist(recipes: RecipeSummary[], nodes: Map<string, RecipeNode>) {
  localStorage.setItem('demo:recipes', JSON.stringify(recipes));
  localStorage.setItem('demo:nodes', JSON.stringify([...nodes.entries()]));
}

export const demoStore: RecipeStore = {
  async list() {
    return get(demoRecipes);
  },
  async get(id) {
    const recipes = get(demoRecipes);
    const summary = recipes.find((r) => r.id === id);
    if (!summary) return null;
    const nodes = get(demoNodes);
    return assembleTree(summary, nodes);
  },
  async create(name) {
    const id = crypto.randomUUID();
    const summary = { id, name, ownerId: DEMO_USER.id, createdAt: new Date() };
    const rootId = crypto.randomUUID();
    const root = { id: rootId, recipeId: id, parentId: null, ... };
    demoRecipes.update((rs) => [...rs, summary]);
    demoNodes.update((ns) => ns.set(rootId, root));
    persist(get(demoRecipes), get(demoNodes));
    return { id };
  },
  async rename(id, name) {
    demoRecipes.update((rs) =>
      rs.map((r) => (r.id === id ? { ...r, name } : r))
    );
    persist(get(demoRecipes), get(demoNodes));
  },
  async remove(id) {
    demoRecipes.update((rs) => rs.filter((r) => r.id !== id));
    demoNodes.update((ns) => {
      const next = new Map(ns);
      for (const [nid, n] of ns) if (n.recipeId === id) next.delete(nid);
      return next;
    });
    persist(get(demoRecipes), get(demoNodes));
  },
  async fork(id) {
    const source = await this.get(id);
    if (!source) throw new Error('Not found');
    const forked = forkRecipe(source); // see fork semantics below
    demoRecipes.update((rs) => [...rs, forked.summary]);
    demoNodes.update((ns) => {
      const next = new Map(ns);
      for (const node of forked.nodes) next.set(node.id, node);
      return next;
    });
    persist(get(demoRecipes), get(demoNodes));
    return { id: forked.summary.id };
  },
  async saveNode(nodeId, changes) {
    demoNodes.update((ns) => {
      const next = new Map(ns);
      const existing = next.get(nodeId);
      if (existing) next.set(nodeId, { ...existing, ...changes });
      return next;
    });
    persist(get(demoRecipes), get(demoNodes));
  }
};
```

State lives in the user's browser (localStorage) so it survives reloads and
multi-instance deploys. There is no server-side state to coordinate. Components
that subscribe to `demoRecipes` and `demoNodes` react automatically — no
`invalidateAll()` needed in demo mode.

### 5. Fork semantics

`forkRecipe(source)` deep-clones the recipe and all nodes with fresh IDs:

```ts
function forkRecipe(source: RecipeTree): { summary: RecipeSummary; nodes: RecipeNode[] } {
  const idMap = new Map<string, string>();
  for (const node of source.nodes) idMap.set(node.id, crypto.randomUUID());
  const newRecipeId = crypto.randomUUID();
  return {
    summary: {
      id: newRecipeId,
      name: `${source.summary.name} (fork)`,
      ownerId: DEMO_USER.id,
      createdAt: new Date()
    },
    nodes: source.nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      recipeId: newRecipeId,
      parentId: n.parentId ? idMap.get(n.parentId)! : null
    }))
  };
}
```

Forked recipes do not share node IDs with the source — edits to the fork do not
affect the source.

### 6. SSR — `src/hooks.server.ts`

In demo mode, install a stub Supabase client so existing child
`+page.server.ts` load functions (which call `locals.supabase.from(...)`) work
unchanged.

```ts
const supabase: Handle = async ({ event, resolve }) => {
  if (isDemoHost(event.url.hostname)) {
    event.locals.supabase = makeStubSupabase(); // returns { data: [], error: null } from .from()
    event.locals.safeGetSession = async () => ({
      session: { user: DEMO_USER } as Session,
      user: DEMO_USER as User
    });
    return resolve(event);
  }
  // ... existing Supabase init
};
```

`makeStubSupabase()` returns an object whose `.from(table).select()` etc.
resolve to `{ data: [], error: null }`. It only needs to support the methods
the existing load functions call — add methods on demand.

### 7. Layout — `src/routes/+layout.server.ts`

```ts
export const load: LayoutServerLoad = async ({ depends, locals, url }) => {
  depends('app:recipes');
  depends('app:recipe-tree');

  if (isDemoHost(url.hostname)) {
    return {
      demoMode: true,
      recipeTree: [],
      session: { user: DEMO_USER },
      user: DEMO_USER,
      ownerId: DEMO_USER.id,
      supabaseConfigured: false
    };
  }

  // ... existing signed-in / anonymous logic
};
```

`recipeTree: []` is intentional — SSR shows nothing, then the client takes
over. The layout passes `data.demoMode` to the client; the layout component
uses it to mount the demo store and to gate the "Reset demo" button.

### 8. Client takeover — `src/routes/+layout.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { isDemoMode } from '$lib/demo-init';
  import { demoRecipes, demoNodes, resetDemoState } from '$lib/recipe-store.demo';
  import { invalidateAll } from '$app/navigation';

  export let data: LayoutData;

  onMount(() => {
    if (data.demoMode) {
      // Mount demo store — components subscribe to demoRecipes / demoNodes
    }
  });

  async function handleReset() {
    resetDemoState();
    await invalidateAll();
  }
</script>

{#if data.demoMode}
  <button on:click={handleReset}>Reset demo</button>
{/if}
```

The recipe list component checks `data.demoMode` and reads from `$demoRecipes`
instead of `data.recipeTree`. Or — simpler — the dispatch functions in
`$lib/recipes` route to the right adapter transparently and the list component
calls `loadRecipeTree()` like it does today.

### 9. Auth in demo mode

The `/auth` page checks `data.demoMode` and skips the OTP form, redirecting to
the home page. `safeGetSession` returns `DEMO_USER` so any code path that reads
the current user gets the demo user. No real Supabase call is made.

## Consequences

**Pros**

- Single codebase, no build fork.
- No module singleton — survives Vite HMR and multi-instance deploys.
- No URL/body parsing — the dispatch functions have typed signatures.
- No null `SupabaseClient` cast — the stub client satisfies existing load functions.
- Components are unaware of demo vs prod; they call `createRecipe(name)` and get
  the right behavior.
- Demo state survives reloads via localStorage and resets via the "Reset demo"
  button.
- Testable: each `RecipeStore` implementation can be unit-tested against a
  shared fixture.

**Cons**

- Mechanical refactor of ~10–20 call sites to use `$lib/recipes` instead of
  `$lib/api` for mutations. Bounded and one-time.
- The stub Supabase client must implement every method existing load functions
  call. Add methods as needed; type errors will surface them.
- Demo state persists per-browser, not per-deployment — release notes should
  mention that the seed may differ across versions in user browsers until they
  hit "Reset demo."
- Auth flow is fully mocked — the demo never exercises the real Supabase OTP path.

## Files to create / modify

| File | Change |
|---|---|
| `src/lib/demo-init.ts` | New — `isDemoMode`, `isDemoHost` |
| `src/lib/demo-seed.ts` | New — static `SEED_RECIPES`, `SEED_NODES` fixtures |
| `src/lib/recipe-store.ts` | New — `RecipeStore` interface + `getRecipeStore()` |
| `src/lib/recipe-store.supabase.ts` | New — adapter wrapping existing handlers |
| `src/lib/recipe-store.demo.ts` | New — localStorage-backed adapter |
| `src/lib/supabase-stub.ts` | New — no-op client returning empty results |
| `src/lib/recipes.ts` | Modify — dispatch functions (`createRecipe`, `renameRecipe`, etc.) |
| `src/lib/api.ts` | Unchanged — used internally by supabase adapter |
| `src/hooks.server.ts` | Modify — demo branch installs stub supabase + fake session |
| `src/routes/+layout.server.ts` | Modify — demo branch returns empty + `demoMode: true` |
| `src/routes/+layout.svelte` | Modify — mount demo store; gate reset button on `data.demoMode` |
| `src/routes/auth/+page.server.ts` | Modify — skip OTP form in demo mode |
| Component call sites | Mechanical refactor: `api.post(...)` → dispatch function |
| `tests/unit/recipe-store.demo.test.ts` | New — covers each branch against a fixed seed |
| `docs/features/demo-mode.md` | New — user-facing feature doc |

## Deployment

`demo.grainofsalt.app` is a separate Vercel project with `VITE_DEMO_MODE=1` set
as an environment variable. The same codebase is deployed to both
`grainofsalt.app` and `demo.grainofsalt.app` — only the env flag differs.

The demo deployment does **not** need real Supabase credentials — the stub
client satisfies all load functions. Production (`grainofsalt.app`) must **not**
set `VITE_DEMO_MODE`.

For local dev: `VITE_DEMO_MODE=1 pnpm run dev` to activate demo mode on any
hostname, or add `127.0.0.1 demo.local` to `/etc/hosts` and visit
`http://demo.local:4173`.
