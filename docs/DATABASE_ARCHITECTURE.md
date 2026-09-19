# Database Architecture

Companion to [`ARCHITECTURE.md`](./ARCHITECTURE.md) §2-3, focused
specifically on what lives where and why, verified table-by-table against
the actual migration files (not just described in prose).

## Three logical database environments

| Environment | Migrations applied | Contains |
|---|---|---|
| **Central** | `supabase/migrations/central/001_central_registry.sql` | `central_businesses`, `central_users`, `central_user_business_access`, `central_audit_logs` — registry + cross-business access ONLY |
| **KMG** (own Supabase project) | `supabase/migrations/business-template/*.sql` (all 10 files) | Every KMG operational table, listed below |
| **Murudeshwara** (own Supabase project) | The exact same `business-template/*.sql` files | Every Murudeshwara operational table — same shape, physically separate data |

**Verified:** grep across `supabase/migrations/central/001_central_registry.sql`
confirms it defines only the 4 registry tables above — no `customers`,
`bills`, `stock_*`, `payments`, `expenses`, or any other operational table
appears there. Central cannot become an accidental dumping ground for
business data because the migration that provisions it never creates those
tables in the first place.

## Business-template schema (applied identically to KMG's and Murudeshwara's projects)

| File | Tables / objects | Responsibility |
|---|---|---|
| `001_core_schema.sql` | `staff_profiles`, `units`, `materials`, `customers`, `current_role_is()`, `is_active_staff()`, `set_updated_at()` | Roles, reference data, product/customer masters |
| `002_stock_schema.sql` | `stock_items`, `stock_movements`, `apply_stock_movement()` | Inventory (raw material, blocks, cutting stone) as real movement history, not one quantity field |
| `003_document_numbering.sql` | `document_sequences`, `next_document_number()` | Safe concurrent numbering per document type per year |
| `004_quotations.sql` | `quotations`, `quotation_items` | Quotation workflow incl. dimension-based line items |
| `005_billing.sql` | `bills`, `bill_items`, `sync_bill_payment_status()` | Normal/EV bills, auto-derived payment status |
| `006_payments_ledger.sql` | `payments`, `customer_ledger`, `append_ledger_entry()`, `record_payment()`, `post_bill_to_ledger()` | Payment recording + tamper-resistant running ledger |
| `007_transport.sql` | `drivers`, `vehicles`, `trips` | Transport/delivery tracking |
| `008_expenses.sql` | `expenses` | Admin-only cost tracking |
| `009_settings_audit.sql` | `settings`, `audit_logs` | Business-specific configuration + audit trail |
| `010_rls_policies.sql` | RLS policies for every table above | Enforcement layer — see `docs/SECURITY.md` |

Every one of these tables carries a primary key (`uuid default gen_random_uuid()`
or a natural composite key for `document_sequences`), and every foreign
key points to a table within the *same* business-template schema — there
is no foreign key anywhere in `business-template/` that reaches into a
different project or into the central schema (verified by inspection:
every `references` clause targets `customers`, `materials`, `units`,
`staff_profiles`, `bills`, `stock_items`, `vehicles`, `drivers`, or
`trips` — all local tables).

## Indexes (verified present)

`customers` (name full-text + phone), `stock_items`/`stock_movements`
(material, reference), `quotations`/`bills` (customer, status, number,
date), `payments` (customer, bill), `customer_ledger` (customer+date),
`drivers`/`vehicles`/`trips` (status, vehicle, driver), `expenses`
(date, category), `audit_logs` (module+record, actor). Composite indexes
were not added beyond these until real query patterns from Phase 6 justify
them (Rule #63 — don't index everywhere speculatively).

## Constraints (verified present)

- `stock_items.quantity_on_hand >= 0` (`stock_nonnegative` check, unless a
  caller explicitly passes `p_allow_negative := true` to
  `apply_stock_movement`).
- `bills.balance_due` is a **generated column** (`grand_total -
  amount_received`), so it can never drift out of sync by a missed update.
- `payments.amount > 0`, `expenses.amount > 0`.
- Enum-style `check` constraints on every status/type/category/role column
  (e.g. `staff_profiles.role in ('admin','staff')`,
  `bills.bill_type in ('normal','ev')`) — invalid values are rejected at
  the database level, not just in a TypeScript type.
- `document_sequences` primary key is `(document_type, year)` — this is
  itself the concurrency guard for numbering (see below).

## Concurrency & consistency (verified against actual function bodies, not assumed)

- **Stock**: `apply_stock_movement()` takes `select ... for update` on the
  specific `stock_items` row before checking/adjusting quantity — two
  concurrent sales of the last unit of stock will serialize on that row
  lock; the second one either fails (negative stock check) or proceeds
  against the updated quantity, never both succeeding against a stale read.
- **Ledger**: `append_ledger_entry()` takes a Postgres advisory transaction
  lock keyed on the customer ID (`pg_advisory_xact_lock`) before reading
  the last running balance, so two simultaneous payments for the same
  customer cannot compute their new balance from the same stale
  "last row" and produce two entries with the same (wrong) balance.
- **Document numbers**: `next_document_number()` uses a single
  `insert ... on conflict (document_type, year) do update` — Postgres
  guarantees this upsert is atomic per row, so two staff creating a
  quotation in the same second cannot receive the same number.
- **Bills**: `payment_status` is recalculated by a `before insert or
  update` trigger from `amount_received`/`grand_total` — it is derived,
  never set directly by application code, so it cannot go stale.

## Corrections made during this verification (see `docs/SECURITY.md` for full detail)

Three functions (`next_document_number`, `append_ledger_entry` +
`record_payment` + `post_bill_to_ledger`) were **non-functional as
originally written** — the RLS policies deliberately grant no direct
INSERT/UPDATE on `document_sequences` or `customer_ledger`, which would
have silently blocked every document number and every ledger post for
every role, Admin included. All three are now `SECURITY DEFINER` with an
explicit in-function `is_active_staff()` authorization check. Two helper
functions (`is_active_staff`, `current_role_is`) had a genuine infinite
recursion bug when evaluated as part of `staff_profiles`' own RLS policy;
both are now `SECURITY DEFINER` with a pinned `search_path`, which breaks
the recursion by letting their internal query bypass RLS as the table
owner. A direct `INSERT` policy on `payments` was removed so every payment
must go through `record_payment()` (closing a gap where a payment could
have been recorded without updating the bill/ledger).

None of this was caught by "the function exists" — it was caught by
tracing what role would actually be executing each statement and whether
an RLS policy exists to permit it.
