# Architecture

Multi-business Stone / Quarry / Factory ERP: one Central gateway, N fully
isolated business portals underneath it. This document is the answer to the
"final architectural requirement" — verify isolation before implementing,
not after.

## 1. Two levels

**Level 1 — Main Branch (Central Home).** A selection gateway, not a
marketing site. Loads only static, non-sensitive business metadata (name,
tagline, location, "configured" status). Never loads any business's
operational data.

**Level 2 — Business Portal.** Everything under `/business/:code/...`:
customers, quotations, bills, payments, ledger, stock, vehicles, drivers,
trips, expenses, reports, settings, audit logs — for exactly one business.

## 2. Database isolation strategy (the core decision)

**Chosen approach: separate Supabase project per business**, not a shared
database with a `business_id` column.

Rationale (Rule #45): a `business_id` filter is one missed `WHERE` clause,
one buggy RLS policy, or one raw SQL query away from a cross-tenant leak. A
separate project makes that class of bug structurally impossible — KMG's
anon key physically cannot query Murudeshwara's Postgres instance, because
it isn't the same instance.

```
CENTRAL PROJECT (registry only)
   central_businesses, central_users, central_user_business_access,
   central_audit_logs

KMG PROJECT (own Postgres)                MURUDESHWARA PROJECT (own Postgres)
   customers, quotations, bills,             customers, quotations, bills,
   payments, customer_ledger, stock_*,       payments, customer_ledger, stock_*,
   vehicles, drivers, trips, expenses,       vehicles, drivers, trips, expenses,
   settings, audit_logs, staff_profiles      settings, audit_logs, staff_profiles
```

Both business projects run the **exact same migration files**
(`supabase/migrations/business-template/`) — one codebase, N databases
(Rule #10/#31). Adding a new quarry is provisioning (new project + same
migrations + a registry row), never new application code (Rule #29/#30 —
see `supabase/README.md`).

Trade-off accepted: this means two (or more) Supabase projects to manage,
and no single SQL query can report across businesses. A future **Central
Analytics** feature (Rule #32) for an explicitly-authorized super admin
would read from each business project separately (one authenticated call
per project) and merge results in the application layer — never via a
cross-project SQL join, because none is possible.

## 3. Connection architecture

```
Browser
  │
  ├── Central Supabase client   (VITE_CENTRAL_SUPABASE_URL / ANON_KEY)
  │      used only on "/" — the gateway
  │
  └── ONE business Supabase client, created lazily on first entry into
      that business (src/lib/supabase/business-client.ts), using that
      business's OWN env vars. Never both business clients at once.
```

- Only **anon keys** ever reach the browser (`.env.example`). Service-role
  keys are commented out, server-side-only, and used solely from Supabase
  Edge Functions if/when a server-side operation needs elevated rights
  (e.g. admin user provisioning) — never from client code (Rule #10/#44).
- Each business's Supabase client uses a distinct `storageKey`
  (`sb-kmg-auth`, `sb-murudeshwara-auth`), so two business sessions cannot
  collide in the same browser profile, and signing out of one never touches
  the other (Rule #14/#26 test 6).
- Real authorization is enforced by **RLS inside each business's own
  database** (`010_rls_policies.sql`), not by hiding UI. Client-side route
  guards (`ProtectedBusinessRoute`) are UX only.

## 4. Authentication & authorization flow

```
User visits "/"
  → Main Branch renders business cards (static metadata only)
User clicks "Sign in to KMG Panel"
  → /business/kmg/  →  BusinessRouteWrapper validates "kmg" against the
    registry (src/types/business.ts) → mounts BusinessProvider(code="kmg")
    → lazily creates the KMG Supabase client
  → BusinessSignIn: Supabase Auth (email+password) against the KMG project
  → On success, BusinessProvider reads staff_profiles.role for this user
    FROM THE KMG PROJECT (role is per-business, Rule #12)
  → ProtectedBusinessRoute allows entry → BusinessLayout renders KMG
    branding permanently in the header → /business/kmg/dashboard
```

A user authenticated into KMG has a session that exists *only* against the
KMG project. To use Murudeshwara, they authenticate separately against the
Murudeshwara project (a `central_users` + `central_user_business_access`
row can grant one person access to both, and a future "business switcher"
UI can offer both sign-ins, but the sessions themselves never merge).

## 5. Role model

Two roles today, per business (Rule #12), enforced in three places:

| Layer | Mechanism |
|---|---|
| UI | Sidebar hides Ledger/Expenses from Staff (convenience only) |
| Routing | (future) route-level role guard once those pages exist |
| Database | RLS policies (`010_rls_policies.sql`) — Admin-only tables for `customer_ledger` and `expenses`, enforced even via direct API calls |

`current_role_is('admin')` treats admin as a superset of staff; staff-only
checks use `is_active_staff()`.

## 6. Business-specific configuration, numbering, documents

- `settings` (one row per key, jsonb value) holds business profile, tax
  defaults, document prefixes, and this business's own payment/UPI
  receiving identity — per-project, so changing KMG's GST default cannot
  touch Murudeshwara's (Rule #16/#38).
- `next_document_number()` (`003_document_numbering.sql`) generates
  `<PREFIX>-<YEAR>-<NNNNNN>` numbers via a row-locked counter — safe under
  concurrent staff creating bills simultaneously (Rule #43/#51/#77).
- PDFs/print documents pull business name, address, GST, logo and
  numbering from that business's own `settings` row — never hardcoded, so a
  KMG bill can never carry Murudeshwara branding by construction (there is
  no Murudeshwara data reachable from the KMG client at all) (Rule #18).

## 7. Business switching & logout (Rule #14/#36)

- **Leave Business** — navigate back to `/` without ending the business's
  Supabase session (`BusinessLayout.handleLeave`).
- **Logout** — calls `signOut()` on that business's client only, then
  returns to that business's sign-in screen.
- Switching to a *different* business always goes back through `/`, so a
  fresh `BusinessProvider` + fresh client is mounted for the new code —
  there is no shared in-memory cache that could leak stale data across
  businesses (Rule #14 test: "no KMG data remains visible after switching
  to Murudeshwara" holds because there is no shared store to leak from).

## 8. Performance (Rule #33/#34)

- The gateway never fetches operational data — only the static
  `BUSINESS_REGISTRY` plus a cheap "is this business's env configured"
  check.
- A business's Supabase client (and therefore its network connection) is
  only created the first time that business is entered
  (`business-client.ts` cache-by-code Map).
- Route-level code splitting for business modules is the natural next step
  once those modules exist (`React.lazy` per feature folder).

## 9. Future quarry provisioning (Rule #29/#30)

Adding "ABC Granites" requires zero application code changes:

1. New Supabase project, run `business-template` migrations.
2. Add its row to `central_businesses`.
3. Add `'abc-granites'` to `BusinessCode` / `BUSINESS_REGISTRY` in
   `src/types/business.ts`.
4. Add its two env vars.

Full checklist: `supabase/README.md`.

## 10. Design system

Dark industrial-navy/graphite base, restrained amber accent, no heavy 3D or
particle effects (Rule #2/#32). Tailwind tokens in `tailwind.config.ts`
(`navy`, `graphite`, `amber`, `cyan`). Light mode and the full component
library (tables, forms, modals) are built out during Phase 5 alongside the
first real operational module, so they're driven by real content rather
than guessed in the abstract (Rule "building" guidance).
