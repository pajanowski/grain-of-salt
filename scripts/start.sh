#!/usr/bin/env bash
# Common startup flows for the grain-of-salt-svelte app.
#
# Modes (selected via the first arg, default: app):
#   app      build the production bundle and run `vite preview` (default)
#   dev      run the dev server
#   all      full bootstrap: install deps if missing, start supabase stack,
#            apply migrations, seed, then preview the built app
#   fresh    full reset: drop supabase db, recreate, apply migrations,
#            seed, then preview
#   status   print supabase stack status + service URLs
#
# Examples:
#   pnpm start              # build + preview production
#   pnpm start:dev          # vite dev
#   pnpm start:all          # bootstrap from scratch
#   pnpm start:fresh        # hard reset
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT}"

cmd="${1:-app}"

ensure_deps() {
	if [ ! -d "${PROJECT_ROOT}/node_modules" ]; then
		echo "→ Installing dependencies (pnpm install)"
		pnpm install --frozen-lockfile
	fi
}

ensure_supabase() {
	if ! supabase status >/dev/null 2>&1; then
		echo "→ Starting Supabase local stack"
		supabase start
	else
		echo "→ Supabase already running"
	fi
}

apply_schema() {
	echo "→ Applying Drizzle schema (db:push)"
	pnpm db:push
}

seed_db() {
	echo "→ Seeding demo data (db:seed)"
	pnpm db:seed
}

build_app() {
	echo "→ Building production bundle"
	pnpm build
}

start_preview() {
	echo "→ Starting preview server on http://localhost:4173"
	exec pnpm preview --port 4173 --host
}

start_dev() {
	echo "→ Starting dev server (vite dev)"
	exec pnpm dev
}

case "${cmd}" in
	app)
		ensure_deps
		build_app
		start_preview
		;;
	dev)
		ensure_deps
		start_dev
		;;
	all)
		ensure_deps
		ensure_supabase
		apply_schema
		seed_db
		build_app
		start_preview
		;;
	fresh)
		ensure_deps
		ensure_supabase
		echo "→ Hard reset: db reset + migrations"
		supabase db reset
		pnpm db:push
		seed_db
		build_app
		start_preview
		;;
	status)
		supabase status
		;;
	*)
		echo "Unknown mode: ${cmd}" >&2
		echo "Usage: pnpm start [app|dev|all|fresh|status]" >&2
		exit 2
		;;
esac
