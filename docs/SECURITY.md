# Security Review

Findings from actually tracing execution paths through the migrations and
application code — not a checklist of "RLS exists, therefore secure."

## Method

For every write path (function or direct table access), I asked: *which
Postgres role actually executes this statement, and does an RLS policy
exist that permits it for that role?* This surfaced three real bugs that
"RLS is enabled on every table" would have hidden.

## Findings and fixes

### 1. CRITICAL — Infinite recursion in `staff_profiles` RLS (fixed)

`current_role_is()` and `is_active_staff()` are used inside
`staff_profiles`' own RLS policies (`"active staff can read profiles"`,
`"admin manages staff profiles"`). Both functions themselves query
`staff_profiles`. As originally written (plain `language sql stable`,
no `security definer`), evaluating either function *as part of* a
`staff_profiles` policy check would re-trigger that same policy on the
function's internal query — infinite recursion. In practice this would
have surfaced as `"stack depth limit exceeded"` the first time any user
tried to read their own role, i.e. on first login.

**Fix applied:** both functions are now `security definer` with
`set search_path = public, pg_temp`, and `execute` is revoked from
`public` and granted only to `authenticated`. As the function owner (the
migration/table owner), their internal query now bypasses `staff_profiles`
RLS entirely instead of re-entering it. `search_path` is pinned so a
malicious session-level `search_path` can't redirect the function to a
different `staff_profiles`-shaped object.

*File:* `supabase/migrations/business-template/001_core_schema.sql`

### 2. CRITICAL — Document numbering was completely non-functional (fixed)

`010_rls_policies.sql` deliberately grants only a `SELECT` policy on
`document_sequences` (by design — no one should hand-edit a counter). But
`next_document_number()` was a plain function that performs an
`INSERT ... ON CONFLICT ... DO UPDATE`. With no INSERT/UPDATE policy for
any role, **every call to this function by any user, Admin included, would
have failed with a permission-denied error** — no quotation, bill,
payment, trip, or expense could ever have been numbered.

**Fix applied:** `security definer` + `set search_path`, with an explicit
`if not is_active_staff() then raise exception ... end if;` replacing the
authorization RLS would otherwise have provided. `execute` restricted to
`authenticated`.

*File:* `supabase/migrations/business-template/003_document_numbering.sql`

### 3. CRITICAL — Ledger writes were completely non-functional (fixed)

Same pattern: `customer_ledger` intentionally has **no** insert/update
policy for any role (comment in `010_rls_policies.sql` even says so — the
intent was right, the consequence wasn't checked). `append_ledger_entry()`,
`post_bill_to_ledger()`, and `record_payment()` all insert into
`customer_ledger` directly. **As originally written, every payment and
every bill would have failed to post to the ledger** for every role.

**Fix applied:** all three functions are now `security definer` with
`set search_path` and an explicit `is_active_staff()` check inside each.

*File:* `supabase/migrations/business-template/006_payments_ledger.sql`

### 4. MEDIUM — Payments could bypass the ledger/bill-sync entirely (fixed)

The original `010_rls_policies.sql` granted staff a **direct INSERT**
policy on `payments`, in addition to `record_payment()` existing as a
"supposed to be the only way in" function. That direct policy meant
application code (or a bug, or a future developer) could insert a payment
row straight into `payments` without going through `record_payment()`,
silently skipping the `bills.amount_received` update and the ledger
credit entry — the exact "operations must succeed or fail together"
failure mode Rule #13 warns against.

**Fix applied:** removed the direct INSERT policy. Staff retain SELECT on
`payments` (needed to show payment history against a bill) but the only
way to create a payment row is now `record_payment()`.

*File:* `supabase/migrations/business-template/010_rls_policies.sql`

## Verified as already correct (not just assumed)

- **Cross-business isolation**: every foreign key in
  `business-template/*.sql` references a table in the same schema; the
  central schema defines no operational tables (`docs/DATABASE_ARCHITECTURE.md`).
  There is no `business_id` column anywhere used as a substitute for real
  isolation — isolation is structural (separate Supabase projects), not a
  filter.
- **Supabase client initialization** (`src/lib/supabase/business-client.ts`):
  clients are created lazily per business code, cached in a `Map`, with a
  **distinct `storageKey`** per business (`sb-kmg-auth`,
  `sb-murudeshwara-auth`) — two business sessions cannot collide in the
  same browser, and there is no shared client instance either business
  could accidentally read through.
- **Environment variables**: `.env.example` only defines `VITE_`-prefixed
  anon-key variables for the three projects; the three
  `*_SUPABASE_SERVICE_ROLE_KEY` lines are present only as **commented-out
  names** with a comment explicitly warning they must never be
  `VITE_`-prefixed or client-side. No `.env`/`.env.local` file exists
  anywhere in the repo or its git history (confirmed by `git log --all
  --diff-filter=A --name-only` — zero matches).
- **Service-role usage**: grep across the entire tracked file set for
  `service_role`, `service-role`, `SUPABASE_SERVICE`, `sk_live`, `sk_test`,
  `BEGIN PRIVATE KEY`, hardcoded `password =`, `secret =`, account/IFSC
  values found **zero** real secrets — only the string
  `SUPABASE_SERVICE_ROLE_KEY` appearing as a name in comments/docs
  warning against its use, and empty placeholder JSON in the
  `payment_identifiers` settings seed row.
- **Audit logging**: `audit_logs` has no direct UPDATE/DELETE policy for
  any role and its INSERT policy requires `actor_id = auth.uid()` — a
  user can log their own actions but cannot forge another user's audit
  row or edit history.
- **Staff restrictions at the DB layer, not just UI**: `customer_ledger`
  SELECT and `expenses` ALL are both restricted to `current_role_is('admin')`
  — confirmed these are real RLS policies on the tables themselves, not
  merely hidden sidebar links (there is no sidebar yet — Phase 6 — so
  there was nothing to hide behind in the first place; the DB layer is
  currently the *only* enforcement, which is the correct order to build
  it in).

## Not yet applicable / genuinely untestable in this environment

- **Payment-provider secrets, webhook, OAuth secrets**: none exist yet —
  no payment provider integration has been built or requested. Nothing to
  audit.
- **Storage access (Supabase Storage buckets)**: no buckets/policies
  created yet — logo/PDF storage is Phase 8.
- **Live RLS behavior under a real JWT**: everything above is verified by
  *reading* the SQL and reasoning about which role executes which
  statement. It has **not** been exercised against a running Postgres
  instance, because no Supabase project exists yet (see
  `docs/DEVELOPMENT_PLAN.md`). Once you provision the three projects and
  apply these migrations, the concrete recommendation is to run the Rule
  #27 cross-business access tests (KMG staff hitting Murudeshwara, URL
  tampering, etc.) against the real projects before any real data enters
  them.
- **GitHub repository visibility**: confirmed still public as of this
  review (I did not and will not change it — you said you'll handle that).
  The secret-scan result above means there is currently nothing sensitive
  in the public repo to be exposed by that.

## What you should do before connecting production Supabase projects

1. Confirm the corrected migrations (this review's fixes) look right —
   they change function security context, not any business logic.
2. Create the 3 Supabase projects and apply migrations per
   `supabase/README.md`.
3. Re-run this review's "Verified as already correct" checks against the
   live projects (e.g. actually try to insert a `customer_ledger` row
   directly via the API as a non-owner role and confirm it's rejected).
4. Only then provide `.env.local` values — anon keys only, never
   service-role keys, and never paste them into chat/commits.
