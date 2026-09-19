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

Phase 1–3 plus a database implementation pass: project structure, the Main
Branch gateway UI, per-business auth/routing wiring, and the complete
database migrations for the central registry + business-template schema,
verified on real PostgreSQL with `npm run test:db` (schema, bill/tax
arithmetic, NULL handling, ledger, stock, measurement sheets, RLS, grants).
Operational module UIs (bills, quotations, ledger, stock, vehicles, reports)
are not built yet — see `docs/DEVELOPMENT_PLAN.md`.

**No Supabase project has been created yet**, so nothing is connected to a
hosted database; each business portal says "not configured" until you add
credentials (deliberately — see below). `npm install`, `npm run typecheck`,
`npm run lint`, `npm run build` and `npm run test:db` all succeed.

### Known `npm audit` findings

`npm audit` reports vulnerabilities in `tar`, which is pulled in only by the
`supabase` CLI devDependency (it pins `tar@7.4.3` exactly). This is
development tooling only — it is not bundled into the browser app. The
suggested fix (`npm audit fix --force`) is a breaking major upgrade of the
CLI, so it is deliberately not applied; revisit when upgrading the Supabase
CLI on purpose.

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
