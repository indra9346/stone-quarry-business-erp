# Performance

Verified against the actual code, not stated as intent.

## Main Branch does not load business data — VERIFIED

`src/features/central-gateway/pages/MainBranchHome.tsx` reads only
`BUSINESS_REGISTRY` (a static in-memory object in
`src/types/business.ts` — name, tagline, location, document prefixes) and
calls `isBusinessConfigured(code)`, which only checks whether env vars are
set (`src/lib/supabase/env.ts`) — it makes no network call and touches no
table. Grep confirms `MainBranchHome.tsx` contains no `.from(`, no
`.select(`, no `supabase` client usage at all.

## Lazy per-business initialization — VERIFIED

`src/lib/supabase/business-client.ts` keys a `Map<BusinessCode,
SupabaseClient>`. `getBusinessClient(code)` only constructs a client (and
therefore only opens a connection / reads that business's env vars) the
first time it's called for that code — which only happens inside
`BusinessProvider` (`src/features/auth/BusinessContext.tsx`), which is
only mounted by `BusinessRouteWrapper` when the URL is actually
`/business/:businessCode/...`. Visiting `/` mounts neither. Entering KMG
never calls `getBusinessClient('murudeshwara')` anywhere in the codebase
(confirmed by inspection — the only call sites are inside
`BusinessContext.tsx` and `BusinessSignIn.tsx`, both scoped to the
provider's own `code`).

## Business-scoped session storage — VERIFIED

Each client is created with a distinct `storageKey`
(`sb-${code}-auth`), so switching businesses can never read a stale
session token left over from the other business's `localStorage` key.

## TanStack Query caching does not mix business contexts

**Current state:** a single global `QueryClient` is created once in
`src/main.tsx` and provided at the app root — this is correct
architecturally (one client is normal), but as of this scaffold **no
query keys have been defined yet** (Phase 6 hasn't built any data-fetching
hooks). This is a real gap to close, not something already solved:

**Required rule for Phase 6** (recorded here so it isn't missed): every
query key for business data MUST be prefixed with the business code, e.g.
`['kmg', 'customers', filters]` / `['murudeshwara', 'customers', filters]`,
never a bare `['customers', filters]`. Because both businesses' React
components could in principle mount against the same `QueryClient`
instance (e.g. if a future "business switcher" keeps both trees mounted),
an un-prefixed key would let Murudeshwara's cached customer list be served
to a KMG component asking for "customers". This is called out explicitly
so whoever builds Phase 6's data hooks does not reintroduce the same class
of bug the Supabase-client isolation already solved at the network layer.

## Pagination, indexed queries — designed in, not yet exercised

- Every list-style table (`customers`, `quotations`, `bills`, `payments`,
  `customer_ledger`, `stock_movements`, `trips`, `expenses`, `audit_logs`)
  has indexes on the columns a filtered/paginated query would use (see
  `docs/DATABASE_ARCHITECTURE.md` "Indexes"). No Phase 6 UI exists yet to
  confirm real query plans — this is a design that anticipates pagination,
  not a benchmarked result.
- No table-scanning "load everything into the browser" pattern exists
  anywhere in the current code, because no data-fetching code exists yet
  to have that problem. Flagging this as "not yet a problem" rather than
  "solved."

## React rendering

- `QueryClient` default options (`src/main.tsx`) disable
  `refetchOnWindowFocus` and set a 30s `staleTime`, reducing redundant
  refetches once real queries exist.
- No unnecessary global state/context re-render sources yet:
  `BusinessContext` is scoped per business (unmounts entirely when you
  leave that business's route tree), not a single app-wide context that
  would re-render unrelated pages on every auth event.

## What's not measurable yet

Bundle size, actual route-transition speed, real query latency, and PDF
generation performance cannot be measured — there is no `npm install`,
build, or live database in this environment yet (see final report,
"Build/typecheck/lint status"). This document records the *strategy*
verified in code; a real performance pass (Phase 9) requires the app
actually running against real data volume.
