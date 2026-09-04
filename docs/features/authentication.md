# Authentication

Two paths to a session: OTP email sign-in via Supabase Auth, or a guest
cookie that grants access to the shared demo tree without an email.

## OTP sign-in

`/auth` is a two-step form:

1. Enter an email → server calls `signInWithOtp` (auto-creates the user
   on first verify).
2. Enter the 8-digit code sent to that inbox → server exchanges it for a
   session.

In local dev the code lands in Inbucket at `http://127.0.0.1:54324`.
Successful verification sets Supabase auth cookies via the
`@supabase/ssr` adapter wired up in `hooks.server.ts`.

## Guest session

"Continue as guest (demo)" sets a `guest=1` cookie (1-day max-age). No
Supabase call. Reads and writes resolve to `DEMO_USER_ID`, so guests
share one demo tree. "End guest session" clears the cookie; any data
the guest added to the demo tree persists across guests.

## Account

`/me` shows the signed-in user's email, id, and account creation
timestamp. Unauthenticated visitors redirect to `/auth`.

## Sign-out

Header form posts to `/auth?/logout`, which clears the Supabase session
and the guest cookie.

## Files

- `src/routes/auth/+page.{svelte,server.ts}` — UI and form actions
- `src/routes/me/+page.{svelte,server.ts}` — account page
- `src/lib/server/auth-guard.ts` — session resolution helpers
- `src/lib/server/db/schema.ts` — `DEMO_USER_ID` constant
