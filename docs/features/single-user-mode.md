# Single-User Local Development

Single-user mode provides zero-login local development, allowing developers to start the application with `just dev` and immediately browse, create, edit, fork, and manage recipes without entering an email or fetching OTP tokens from Mailpit.

## Behavior

- Controlled by the `SINGLE_USER_MODE` environment variable (`SINGLE_USER_MODE=true` in `.env.example`).
- Server hooks (`src/hooks.server.ts`) automatically resolve requests without active Supabase sessions to a synthetic user (`DEMO_USER_ID = 00000000-0000-0000-0000-000000000001`).
- Visiting `/` marks the session signed in and directs to `/mise`.
- Visiting `/auth` automatically redirects straight to `/mise`.
- Seeded recipes (`scripts/seed.ts`) owned by `DEMO_USER_ID` are immediately available in the recipe list and dashboard.
- Test environments and production builds keep `SINGLE_USER_MODE=false`, preserving standard Supabase OTP authentication and strict multi-user RLS enforcement.

## Files

- `src/lib/server/singleUser.ts` — Single-user mode configuration, synthetic demo user and session definitions.
- `src/hooks.server.ts` — Server hooks injecting synthetic session when single-user mode is active.
- `src/lib/server/profiles.ts` — Profile resolution and fallback creation for `DEMO_USER_ID`.
- `.env.example` — Default configuration for local developer environments.
- `Justfile` — Commands running development in single-user mode and test preview in multi-user mode.
