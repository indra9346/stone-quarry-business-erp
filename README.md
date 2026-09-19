# Stone Business Panel — Multi-Business Quarry / Factory ERP

A central gateway (Main Branch) that routes into completely isolated
business portals — **KMG Stones** and **Murudeshwara Stones** today, with
more quarries addable later without rewriting the app.

```
MAIN BRANCH (Central Gateway)
        │
   ┌────┴────┐
KMG STONES   MURUDESHWARA STONES
   │              │
KMG DATABASE   MURUDESHWARA DATABASE   (separate Supabase projects)
```

Documentation:
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (design) ·
[`docs/DATABASE_ARCHITECTURE.md`](./docs/DATABASE_ARCHITECTURE.md) (schema/isolation detail) ·
[`docs/BUSINESS_RULES.md`](./docs/BUSINESS_RULES.md) (confirmed rules + open questions) ·
[`docs/RECEIPT_AND_DOCUMENT_ANALYSIS.md`](./docs/RECEIPT_AND_DOCUMENT_ANALYSIS.md) (source evidence) ·
[`docs/SECURITY.md`](./docs/SECURITY.md) (review findings + fixes) ·
[`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) ·
[`docs/DEVELOPMENT_PLAN.md`](./docs/DEVELOPMENT_PLAN.md) (phased roadmap + real status).

## Status

Phase 1–3 scaffold plus a verification/correction pass: project structure,
the Main Branch gateway UI, per-business auth/routing wiring, and complete
database migrations for the central registry + business-template schema —
re-reviewed, with three real RLS/function bugs found and fixed (see
`docs/SECURITY.md`). Operational modules (bills, quotations, ledger, stock,
vehicles, reports UI) are not built yet — see `docs/DEVELOPMENT_PLAN.md`.
Nothing here is connected to a live Supabase project yet; the app's code
assumes the gateway will render and each business portal will say "not
configured" until you wire up real credentials (deliberately — see below) —
this has not been run/built in this environment (no `npm install` has
succeeded here; see `docs/DEVELOPMENT_PLAN.md` for why).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase project URLs/anon keys once you have them
npm run dev
```

### Setting up the databases

You need up to 3 Supabase projects to get real isolation:

1. **Central** — small registry project (business list, cross-business access).
2. **KMG** — KMG Stones' own operational database.
3. **Murudeshwara** — Murudeshwara Stones' own operational database.

Apply the SQL in `supabase/migrations/central/` to the Central project, and
`supabase/migrations/business-template/` to BOTH the KMG and Murudeshwara
projects (identical SQL, separate databases). Full steps:
[`supabase/README.md`](./supabase/README.md).

**Do not put a `SUPABASE_SERVICE_ROLE_KEY` in this repo or in a `VITE_`
variable.** Only the anon key, which RLS protects, ever reaches the browser.

## Project structure

```
src/
  features/
    central-gateway/   Main Branch home + business route wrapper
    auth/               Per-business Supabase auth (BusinessProvider, sign-in)
    dashboard/          Business dashboard shell
  layouts/              Business portal shell (header/branding/logout)
  lib/supabase/         Central client + per-business client factory (lazy, isolated)
  types/business.ts     The single source of truth for known business codes
supabase/
  migrations/central/            Central registry schema
  migrations/business-template/  Applied to every business's own project
```

## Tech stack

React + TypeScript + Vite + Tailwind + Supabase/PostgreSQL + TanStack Query
+ React Router + Zod/React Hook Form. See `docs/ARCHITECTURE.md` for rationale.
