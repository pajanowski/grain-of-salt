# ADR 0003 — Demo Mode

## Status
Proposed

## Context

A visitor at `demo.grainofsalt.app` must be able to explore the full app UI without
creating an account or touching the real Supabase database. They can create, rename,
fork, and delete recipes. All state lives in the browser's memory and is seeded from
static data on first load. The experience is indistinguishable from the production app
from the user's perspective.

Constraint: **one codebase**, no build fork, no separate deployment artifact. The app
morphs at boot based on the hostname.

## Decision

### 1. Detection — `src/lib/demo-init.ts`

```ts
// Client-side only
export const isDemoMode =
  typeof window !== 'undefined' &&
  (window.location.hostname.startsWith('demo.') ||
    new URLSearchParams(window.location.search).has('demo'));

// Server-side only (no window)
export function isDemoHost(hostname: string): boolean {
  return hostname.startsWith('demo.') || !!process.env.VITE_DEMO_MODE;
}
```

`VITE_DEMO_MODE` env var enables demo mode in local dev without needing to edit
`/etc/hosts`.

### 2. Shared state — `src/lib/demo-store.ts`

A plain ES module singleton. The same module is imported by both the client-side
interceptor and the server-side load functions — Node.js module caching means they
get the same instance within a single process.

```ts
export interface DemoUser {
  id: string;
  email: string;
}

export interface DemoNode {
  id: string;
  recipeId: string;
  parentId: string | null;
  type: 'branch' | 'leaf';
  name: string;
  ingredientChanges: Change<Ingredient>[];
  directionChanges: Change<Direction>[];
  createdAt: Date;
}

export interface DemoRecipe {
  id: string;
  ownerId: string;
  name: string;
  history: DemoNode[];
  createdAt: Date;
}

export interface DemoState {
  user: DemoUser;
  recipes: DemoRecipe[];
}

export const demoState: DemoState = { user: DEMO_USER, recipes: [] };

export const DEMO_USER: DemoUser = {
  id: 'demo-user-id',
  email: 'demo@grainofsalt.app'
};

export function seedDemoState() {
  demoState.recipes = [/* 2-3 pre-built DemoRecipe objects */];
}

export function resetDemoState() {
  seedDemoState();
}
```

**Seed data** — 2–3 recipes with ingredient and direction rows so the demo feels
populated on first visit. Shape matches the output of `getRecipeTree()`.

### 3. Request interceptor — `src/lib/demo-interceptor.ts`

Registered once on the exported `api` instance when `isDemoMode` is true. Every
matching request is handled in-memory; **nothing is passed through to the network**.

```ts
import { api } from './api';
import { demoState, resetDemoState } from './demo-store';
import { isDemoMode } from './demo-init';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

function intercepted(config: InternalAxiosRequestConfig): AxiosResponse {
  return {
    data: undefined,
    status: 200,
    statusText: 'OK',
    headers: {},
    config
  };
}

function notFound(config: InternalAxiosRequestConfig): AxiosResponse {
  return { data: 'Not found', status: 404, statusText: 'Not Found', headers: {}, config };
}

export function registerDemoInterceptor() {
  if (!isDemoMode) return;

  seedDemoState();

  api.interceptors.request.use((config) => {
    const url = config.url ?? '';
    const [, , , , , path1, path2, path3] = url.split('/');
    // path1: 'api', path2: 'recipe'|'recipe-node'|'auth', path3: id or action

    // Supabase auth — return a fake session immediately
    // These prevent the browser from trying to reach *.supabase.co
    if (path2 === 'auth') {
      return intercepted(config);
    }

    // POST /api/save — create recipe
    if (config.method === 'post' && path2 === 'save') {
      const params = new URLSearchParams(config.data);
      const name = params.get('recipeName') ?? 'Untitled';
      const recipe = buildDemoRecipe(name);
      demoState.recipes.push(recipe);
      return { ...intercepted(config), data: { id: recipe.id, name: recipe.name } };
    }

    // GET /api/recipe/:id
    if (config.method === 'get' && path2 === 'recipe' && path3) {
      const recipe = demoState.recipes.find((r) => r.id === path3);
      if (!recipe) return notFound(config);
      return { ...intercepted(config), data: recipe };
    }

    // PATCH /api/recipe/:id — rename
    if (config.method === 'patch' && path2 === 'recipe' && path3) {
      const params = new URLSearchParams(config.data);
      const recipe = demoState.recipes.find((r) => r.id === path3);
      if (recipe) recipe.name = params.get('name') ?? recipe.name;
      return { ...intercepted(config), data: { id: path3 } };
    }

    // DELETE /api/recipe/:id
    if (config.method === 'delete' && path2 === 'recipe' && path3) {
      demoState.recipes = demoState.recipes.filter((r) => r.id !== path3);
      return { ...intercepted(config), data: { id: path3 } };
    }

    // POST /api/recipe/:id/fork
    if (config.method === 'post' && path2 === 'recipe' && path3) {
      const source = demoState.recipes.find((r) => r.id === path3);
      if (!source) return notFound(config);
      const forked = forkDemoRecipe(source);
      demoState.recipes.push(forked);
      return { ...intercepted(config), status: 201, data: { id: forked.id } };
    }

    // GET /api/recipe-node/:nodeId
    if (config.method === 'get' && path2 === 'recipe-node' && path3) {
      const node = demoState.recipes.flatMap((r) => r.history).find((n) => n.id === path3);
      if (!node) return notFound(config);
      return { ...intercepted(config), data: node };
    }

    // PUT /api/recipe-node/:nodeId — save leaf changes
    if (config.method === 'put' && path2 === 'recipe-node' && path3) {
      const body = JSON.parse(config.data ?? '{}');
      for (const recipe of demoState.recipes) {
        const node = recipe.history.find((n) => n.id === path3);
        if (node) {
          node.ingredientChanges = body.ingredientChanges ?? [];
          node.directionChanges = body.directionChanges ?? [];
          return { ...intercepted(config), data: { id: path3 } };
        }
      }
      return notFound(config);
    }

    // Anything else — let it pass through (should not occur in normal use)
    return config;
  });
}
```

> **Why not return a `Promise`?** Axios interceptors support returning a resolved
> `Promise<AxiosResponse>` — synchronous objects work too and avoid any async
> overhead. Both are equivalent.

### 4. Server-side awareness

#### `src/hooks.server.ts`

```ts
import { isDemoHost } from '$lib/demo-init';

const supabase: Handle = async ({ event, resolve }) => {
  if (isDemoHost(event.url.hostname)) {
    // Wire a fake session — no Supabase call, no cookies checked
    event.locals.supabase = null as unknown as SupabaseClient<Database>;
    event.locals.safeGetSession = async () => ({
      session: { user: DEMO_USER } as Session,
      user: DEMO_USER as User
    });
    return resolve(event, { /* filterSerializedResponseHeaders */ });
  }
  // ... existing Supabase init
};
```

#### `src/routes/+layout.server.ts`

```ts
import { isDemoHost } from '$lib/demo-init';
import { demoState, DEMO_USER } from '$lib/demo-store';

export const load: LayoutServerLoad = async ({ depends, locals, url }) => {
  depends('app:recipes');
  depends('app:recipe-tree');

  if (isDemoHost(url.hostname)) {
    // demoState is the same module singleton that the interceptor mutates
    return {
      recipeTree: buildRecipeTreeFromDemo(demoState.recipes),
      session: { user: DEMO_USER },
      user: DEMO_USER,
      ownerId: DEMO_USER.id,
      supabaseConfigured: true
    };
  }

  // ... existing signed-in / anonymous logic
};
```

`buildRecipeTreeFromDemo` maps `DemoRecipe[]` to the same `RecipeTree` shape that
`getRecipeTree()` returns, so the `RecipeList` component sees identical data.

### 5. `invalidateAll()` behavior

After any mutation (`api.post('/api/save', ...)`, etc.) the existing code calls
`invalidateAll()`. In demo mode this triggers an SSR re-render of `+layout.server.ts`
which re-imports `demoState` — the **same module instance** the interceptor is
mutating. Node.js module caching guarantees both reference the same object, so the
SSR load returns the current state of `demoState.recipes`. The `RecipeList`
re-renders with up-to-date data. This is a fast in-process SSR render — no
Supabase, no network.

### 6. Reset

A "Reset demo" button (demo mode only) in the header calls `resetDemoState()` and
then `invalidateAll()`, restoring the seed and refreshing the tree.

### 7. Auth in demo mode

The demo user is always "signed in" — the server `safeGetSession` returns
`DEMO_USER` and the `session` cookie is set by a demo-aware auth handler. No OTP
email is sent; the `/auth` page detects demo mode and skips the email/code form
entirely, automatically signing the demo user in on page load.

## Consequences

**Pros**
- Single codebase, no build fork.
- `api` is unchanged in production — the interceptor is never registered.
- All mutations go through `api.*` calls that are already in the codebase; no
  call-site changes needed.
- `invalidateAll()` works correctly because server and client share the module
  singleton — the SSR load returns the interceptor's current state.
- Demo state resets on each deployment (static seed), not persisted — no stale
  state between releases, no cleanup needed.

**Cons**
- **Single-process constraint**: the module singleton only works in single-process
  Node.js deployments. Vercel Edge, Cloudflare Workers, and similar runtimes
  isolate each request's module scope, so server-side `demoState` would be a fresh
  import per request. For those platforms, the state would need to be serialized
  to a cookie or header and re-read on each SSR request — add this as a follow-up
  if multi-instance hosting is needed.
- Auth flow is fully mocked — the demo never exercises the real Supabase OTP path.

## Files to create / modify

| File | Change |
|---|---|
| `src/lib/demo-init.ts` | New — `isDemoMode`, `isDemoHost()` |
| `src/lib/demo-store.ts` | New — `demoState`, `DEMO_USER`, `seedDemoState()`, `resetDemoState()` |
| `src/lib/demo-interceptor.ts` | New — axios interceptor with all endpoint mocks |
| `src/hooks.server.ts` | Add demo `safeGetSession` branch in `supabase` handle |
| `src/routes/+layout.server.ts` | Add demo branch that returns `demoState` as `recipeTree` |
| `src/routes/+layout.svelte` | Import `registerDemoInterceptor()`; add "Reset demo" button |
| `src/routes/auth/+page.server.ts` | Skip OTP form in demo mode, auto sign-in as demo user |
| `docs/features/demo-mode.md` | New — user-facing feature doc |

## Deployment

`demo.grainofsalt.app` is a separate Vercel project with `VITE_DEMO_MODE=1` set as
an environment variable. The same codebase is deployed to both
`grainofsalt.app` and `demo.grainofsalt.app` — only the env flag differs.

For local dev: `VITE_DEMO_MODE=1 pnpm run dev` to activate demo mode on any hostname.
