# Grain of Salt

Grain of Salt is a recipe web application designed for iterative cooking and recipe experimentation. Built around a Git-like directed acyclic graph (DAG), recipes evolve through forks, diffs, and lineage tracking rather than static clones.

---

## Key Features

- **DAG Recipe Lineage & Branching:** Recipes are structured as nodes in a directed acyclic graph. Fork any recipe to create a variation while preserving full change history and lineage.
- **Materialized State & Diffs:** Replays ingredient and direction changes (`add`, `edit`, `remove`, `substitute`) down the ancestor chain to materialize the active recipe at read time.
- **Direction Ingredient References:** Link directions to ingredients directly with `#ingredient-name` syntax, rendering interactive inline badges with quantities and units.
- **Multi-User Favorites:** Junction-backed favorite bookmarks with composite indexing and Row-Level Security. Interactive header star toggle across both workspace and public views, plus author attribution badges on the home dashboard.
- **Home Dashboard & Recipe Tree:** Clean 3-column responsive layout showcasing favorited recipes, the 5 most recently edited recipes, and the complete navigable recipe hierarchy tree.
- **Public Sharing:** Share individual recipe nodes publicly with read-only views (`/recipe/[id]`) and community bookmarking.
- **Zero-Login Local Development:** Built-in single-user development mode for instant local iteration without authentication friction.

---

## Tech Stack

- **Frontend & Fullstack:** [Svelte 5](https://svelte.dev/) + [SvelteKit 2](https://kit.svelte.dev/)
- **Styling & UI:** [Tailwind CSS v4](https://tailwindcss.com/), [bits-ui](https://bits-ui.com/), [Lucide Svelte](https://lucide.dev/)
- **Graph Visualization:** [@xyflow/svelte](https://svelteflow.dev/) & [Dagre](https://github.com/dagrejs/dagre)
- **Database & Auth:** [PostgreSQL](https://www.postgresql.org/), [Supabase](https://supabase.com/), [Drizzle ORM](https://orm.drizzle.team/)
- **Testing:** [Vitest](https://vitest.dev/) (Unit), [Playwright](https://playwright.dev/) (End-to-End)
- **Task Runner & Package Manager:** [Just](https://github.com/casey/just), [pnpm](https://pnpm.io/)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- [pnpm](https://pnpm.io/) (`corepack enable pnpm` or `npm install -g pnpm`)
- [Docker](https://www.docker.com/) (for local Supabase services)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Just](https://github.com/casey/just) task runner (optional, but recommended)

### Quick Setup

1. **Clone the repository and install dependencies:**
   ```sh
   git clone <repo-url>
   cd grain-of-salt-svelte
   pnpm install
   ```

2. **Bootstrap local environment and database:**
   ```sh
   just setup-dev
   ```
   *(This starts Supabase, applies database migrations, and seeds initial demo recipes.)*

3. **Start the local development server:**
   ```sh
   just dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser. Single-user mode is enabled by default for local development, allowing instant access to `/mise` without manual login.

---

## Development & Database Commands

| Command | Description |
| :--- | :--- |
| `just setup-dev` | Installs dependencies, boots Supabase, applies migrations, and seeds demo data |
| `just dev` | Runs the Vite dev server with zero-login `SINGLE_USER_MODE=true` |
| `pnpm db:start` | Starts local Supabase container services (Postgres, Auth, Inbucket) |
| `pnpm db:status` | Displays running Supabase ports and API keys |
| `pnpm db:reset` | Resets local database and reruns migrations and seed scripts |
| `pnpm db:seed` | Re-seeds sample demo recipe DAGs and profiles |
| `pnpm db:studio` | Launches Drizzle Studio database viewer |
| `pnpm check` | Runs SvelteKit type checks (`svelte-check`) |
| `pnpm lint` | Runs ESLint and Prettier checks |

---

## Testing

### Unit Tests
Run unit tests with Vitest:
```sh
pnpm test:unit
```

### End-to-End Tests
Run Playwright end-to-end tests:
```sh
# Run all E2E tests in isolated test environment
just agent-e2e

# Run a specific test file
just agent-e2e tests/e2e/recipe-create.e2e.ts

# Run with interactive UI
just test-e2e-ui
```

*Note: E2E tests automatically run with `SINGLE_USER_MODE=false` against real Supabase authentication to validate full security, session management, and authorization flows.*

---

## Architecture & Documentation

Comprehensive architectural design and feature specifications are located in the `docs/` directory:

- [System Overview & DAG Data Model](docs/overview.md)
- [Feature Documentation](docs/features/README.md)
  - [Recipe Favorites & Junction Architecture](docs/features/recipe-favorites.md)
  - [Recipe Dashboard & Home Feeds](docs/features/recipe-dashboard.md)
  - [Single-User Dev Setup](docs/features/single-user-mode.md)
  - [Recipe Branching & Tree Navigation](docs/features/recipe-tree.md)
- [Architectural Decision Records (ADRs)](docs/adr/)
  - [ADR 0001: Per-Node In-Place Edits](docs/adr/0001-per-node-in-place-edits.md)
  - [ADR 0002: Fork as Chain Extension](docs/adr/0002-fork-as-chain-extension.md)
