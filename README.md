# Grain of Salt

A recipe management web application built around a directed acyclic graph (DAG) to track recipe variations, forks, and revision history.

---

## Features

- **Recipe Graph & Lineage:** Model recipes as nodes in a DAG where each variation forks from a parent, keeping the history and progression intact.
- **Materialized State & Diffs:** Replays ingredient and direction changes (`add`, `edit`, `remove`, `substitute`) along the ancestry path to materialize the current recipe state.
- **Direction Ingredient References:** Link directions to ingredients using `#ingredient-name` syntax, rendering inline badges with quantities and units.
- **Recipe Favorites:** Bookmark personal or public recipes and view them on the `/mise` dashboard.
- **Dashboard & Hierarchy:** View favorited recipes, the 5 most recently edited recipes, and the complete navigable recipe hierarchy tree.
- **Public Sharing:** Share individual recipe nodes via read-only URLs (`/recipe/[id]`).
- **Single-User Dev Mode:** Local development mode (`SINGLE_USER_MODE=true`) bypasses authentication for faster iteration.

---

## Tech Stack

- **Framework:** [Svelte 5](https://svelte.dev/) & [SvelteKit 2](https://kit.svelte.dev/)
- **UI & Styling:** [Tailwind CSS v4](https://tailwindcss.com/), [bits-ui](https://bits-ui.com/), [@lucide/svelte](https://lucide.dev/)
- **Graph Layout & Visualization:** [@xyflow/svelte](https://svelteflow.dev/) & [@dagrejs/dagre](https://github.com/dagrejs/dagre)
- **Database & Auth:** [PostgreSQL](https://www.postgresql.org/), [Supabase](https://supabase.com/), [Drizzle ORM](https://orm.drizzle.team/)
- **Testing:** [Vitest](https://vitest.dev/) (Unit), [Playwright](https://playwright.dev/) (End-to-End)
- **Tooling:** [Just](https://github.com/casey/just), [pnpm](https://pnpm.io/)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/)
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
   *(Installs dependencies, starts Supabase, applies migrations, and seeds sample data.)*

3. **Start the local development server:**
   ```sh
   just dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser. Single-user mode is enabled by default for local development, allowing immediate access to `/mise`.

---

## Development & Database Commands

| Command | Description |
| :--- | :--- |
| `just setup-dev` | Installs dependencies, starts Supabase, applies migrations, and seeds demo data |
| `just dev` | Runs Vite dev server with zero-login `SINGLE_USER_MODE=true` |
| `pnpm db:start` | Starts local Supabase container services (Postgres, Auth, Inbucket) |
| `pnpm db:status` | Displays running Supabase ports and API keys |
| `pnpm db:reset` | Resets local database and reapplies migrations and seed scripts |
| `pnpm db:seed` | Seeds sample recipe DAGs and profiles |
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
# Run all E2E tests
just test-e2e

# Run a specific test file
just test-e2e tests/e2e/recipe-create.e2e.ts

# Run with interactive UI
just test-e2e-ui
```

*Note: E2E tests automatically run with `SINGLE_USER_MODE=false` against local Supabase authentication.*

---

## Architecture & Documentation

Detailed documentation and architectural decision records are in `docs/`:

- [System Overview & DAG Data Model](docs/overview.md)
- [Feature Documentation](docs/features/README.md)
  - [Recipe Favorites](docs/features/recipe-favorites.md)
  - [Recipe Dashboard](docs/features/recipe-dashboard.md)
  - [Single-User Dev Setup](docs/features/single-user-mode.md)
  - [Recipe Branching & Tree Navigation](docs/features/recipe-tree.md)
- [Architectural Decision Records (ADRs)](docs/adr/)
  - [ADR 0001: Per-Node In-Place Edits](docs/adr/0001-per-node-in-place-edits.md)
  - [ADR 0002: Fork as Chain Extension](docs/adr/0002-fork-as-chain-extension.md)
