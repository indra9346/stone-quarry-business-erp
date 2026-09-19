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
  warning against its use.
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

## Second review — database implementation pass

Findings from re-tracing every write path, then **exercising the corrected
migrations on real PostgreSQL** (`npm run test:db`: PGlite/PG 18, migrations
run as a non-superuser owner, checks run under `SET ROLE anon/authenticated`
with Supabase-equivalent default grants).

| # | Severity | Finding | Fix |
|---|---|---|---|
| 5 | High | Staff held a blanket `UPDATE` on `bills`, so they could edit `amount_received`, `payment_status`, `grand_total` or `status` directly, defeating the "payments only via `record_payment()`" rule. | Column-level grants: clients can write only descriptive columns; totals are derived by trigger; `amount_received` is written only by `record_payment()`. |
| 6 | High | `record_payment()`, `post_bill_to_ledger()` and `append_ledger_entry()` trusted caller-supplied customer, amount, payment number and `created_by`; a caller could post any amount, name the wrong customer, forge the actor, or post a bill twice. | Rewritten: all values are read from the bill row, actor is `auth.uid()`, payment numbers are generated, unique ledger reference index prevents double posting, bill must be posted and not over-paid, composite FK ties payment to the bill's customer. `append_ledger_entry()` is no longer callable by clients. |
| 7 | High | Ledger running balance was ordered by `created_at` (transaction start time), which does not follow lock order; two concurrent postings could compute the balance from the wrong "previous" row. | Ordered by an identity column `entry_seq`. |
| 8 | High | Staff could write `stock_items.quantity_on_hand` and insert `stock_movements` directly, so stock could drift from its history. `p_allow_negative` contradicted the non-negative CHECK. | Column grants + no insert policy; `apply_stock_movement()` is `SECURITY DEFINER`, takes the actor from `auth.uid()`; negative stock removed as an option; per-type direction checks. |
| 9 | Medium | `audit_logs` accepted client-written rows (a user could log arbitrary content as themselves) and only a few actions were logged. | No client write privilege; row-change triggers on every operational table (`012_audit_triggers.sql`). |
| 10 | Medium | Functions were revoked from `public` only. On Supabase, `anon` also holds explicit default `EXECUTE`, so revoking from `public` alone leaves it callable. | Every function is revoked from `public` and `anon`; tests assert this per function. |
| 11 | Medium | `bills`/`stock`/all tables relied on Supabase's default "ALL to anon + authenticated" grants with RLS as the only barrier. | `010` revokes everything and re-grants the minimum; default privileges revoked for future tables. |
| 12 | Medium | A posted bill's total/customer could be changed afterwards, silently desynchronising the ledger; staff could delete bills. | `bills_before_write()` freezes a posted bill's identity and total; delete is admin-only and only for an un-posted bill; `cancel_bill()` reverses the ledger debit. |
| 13 | Low | `next_document_number()` used the server's year, not the business timezone, and accepted any document type. | `Asia/Kolkata` year; CHECK on document type. |

**Removed concept.** The earlier idea that "the person whose number is
entered receives the amount" is deleted: no column, function, trigger or
policy reads a phone/mobile number to route money. `npm run test:db`
scans column names and function bodies to keep it that way.

**Result.** 261 checks pass, including: staff blocked from ledger/expenses/
audit; anon blocked from every table and function; inactive and profile-less
users blocked; direct writes to ledger, payments, stock quantity, bill
totals and audit logs rejected for every client role; KMG and Murudeshwara
schemas identical (columns, constraints, indexes, function bodies,
policies).

## Not yet applicable / not yet verified

- **Live Supabase**: the migrations have been verified on real PostgreSQL
  but **not yet applied to a hosted Supabase project** (none has been
  created). Supabase-specific behaviour (real JWT claims, `auth.users`
  triggers, PostgREST) is emulated, not exercised.
- **Payment-provider secrets, webhook, OAuth secrets**: none exist; no
  payment provider integration has been built or requested.
- **Storage buckets**: none created yet (logo/PDF storage is Phase 8).
- **GitHub repository visibility**: confirmed still public as of this
  review (I did not and will not change it — you said you'll handle that).
  The secret-scan result above means there is currently nothing sensitive
  in the public repo to be exposed by that.

## What to do before connecting production Supabase projects

1. Create the projects and apply the migrations per `supabase/README.md`.
2. Create the first admin (Auth user + `staff_profiles` row with role
   `admin`) through the SQL editor or service role — no client can create the
   first admin.
3. Re-run the role checks against the live project with real JWTs (staff
   cannot read the ledger/expenses; cross-business URL tampering).
4. Provide `.env.local` values — anon keys only, never service-role keys,
   and never paste them into chat/commits.
