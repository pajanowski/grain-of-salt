# Features

User-facing capabilities of Grain of Salt, plus one dev-tooling doc
([demo data](./demo-data.md)). Each page describes the UI and the wiring
under it. The [project overview](../overview.md) explains the underlying
DAG model; recipe semantics are pinned by [ADR 0001](../adr/0001-per-node-in-place-edits.md)
and [ADR 0002](../adr/0002-fork-as-chain-extension.md).

## User-facing

- [Authentication](./authentication.md) — OTP email sign-in, guest session, account page, sign-out
- [Recipe tree](./recipe-tree.md) — Nested list of all recipes on the home page
- [Recipe creation](./recipe-creation.md) — Inline form on the home page
- [Recipe view](./recipe-view.md) — `/recipes/[slug]` with materialized state and parent breadcrumbs
- [Recipe editing](./recipe-editing.md) — Add/edit/remove/reorder ingredients and directions, per-change notes, in-place save
- [Recipe history](./recipe-history.md) — Chain of nodes with color-coded diffs
- [Forking](./forking.md) — Append a new node to a recipe's chain (ADR 0002)
- [Recipe management](./recipe-management.md) — Rename and delete a recipe

## Development

- [Demo data](./demo-data.md) — Sample recipes populated by `scripts/seed.ts`
