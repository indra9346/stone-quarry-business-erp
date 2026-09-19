# Database Architecture

Companion to [`ARCHITECTURE.md`](./ARCHITECTURE.md) §2-3, focused
specifically on what lives where and why, verified table-by-table against
the actual migration files (not just described in prose).

## Three logical database environments

| Environment | Migrations applied | Contains |
|---|---|---|
| **Central** | `supabase/migrations/central/001_central_registry.sql`, `002_grants.sql` | `central_businesses`, `central_users`, `central_user_business_access`, `central_audit_logs` — registry + cross-business access ONLY |
| **KMG** (own Supabase project) | `supabase/migrations/business-template/*.sql` (all 12 files) | Every KMG operational table, listed below |
| **Murudeshwara** (own Supabase project) | The exact same `business-template/*.sql` files | Every Murudeshwara operational table — same shape, physically separate data |

**Verified:** grep across `supabase/migrations/central/001_central_registry.sql`
confirms it defines only the 4 registry tables above — no `customers`,
`bills`, `stock_*`, `payments`, `expenses`, or any other operational table
appears there. Central cannot become an accidental dumping ground for
business data because the migration that provisions it never creates those
tables in the first place.

## Business-template schema (applied identically to KMG's and Murudeshwara's projects)

| File | Objects | Responsibility |
|---|---|---|
| `001_core_schema.sql` | `staff_profiles`, `units` (empty), `materials`, `customers`, `current_role_is()`, `is_active_staff()`, `set_updated_at()`, `stamp_created_by()` | Roles, reference data, masters |
| `002_stock_schema.sql` | `stock_items`, `stock_movements`, `apply_stock_movement()`, view `stock_balances` | Movement-based inventory: Opening + Received − Used ± Adjustments = Current |
| `003_document_numbering.sql` | `document_sequences`, `next_document_number()` | Concurrency-safe *generated* numbers (manual numbers bypass it) |
| `004_quotations.sql` | `quotations`, `quotation_items` | Provisional quotation module |
| `005_billing.sql` | `bills`, `bill_items`, `bills_before_write()`, `bill_items_touch_bill()` | EV/Normal bills, derived totals and status |
| `006_payments_ledger.sql` | `payments`, `customer_ledger`, `post_bill_to_ledger()`, `record_payment()`, `cancel_bill()`, `record_ledger_adjustment()`, internal `append_ledger_entry()` | Customer payments and the append-only ledger |
| `007_transport.sql` | `drivers`, `vehicles`, `trips` + FKs from `bills` | Transport |
| `008_expenses.sql` | `expenses` | Admin-only business expenses |
| `009_settings_audit.sql` | `settings`, `audit_logs`, `audit_row_change()` | Configuration + audit function |
| `010_rls_policies.sql` | table privileges (column-level for bills/stock) + RLS policies | Enforcement layer |
| `011_measurement_sheets.sql` | `measurement_sheets`, `measurement_sheet_rows`, view `measurement_sheet_verification` | Independent measurement documents, stored verbatim |
| `012_audit_triggers.sql` | audit triggers on every operational table | Audit trail |

21 tables. Every foreign key targets a table in the same business database.
There is no `business_id` column anywhere, and no operational table in the
Central project.

## Key modelling decisions

- **NULL vs 0.** Blank source values are `NULL`: `bill_items.quantity/unit/
  rate/amount/hsn_code`, `bills.cgst/sgst/igst_percent and _amount`,
  every measurement-row value. Derived totals (`subtotal`, `tax_amount`,
  `grand_total`) are real numbers.
- **Bill arithmetic** is computed in `bills_before_write()`; a line's amount
  must equal `round(quantity × rate, 2)` when all three are present;
  `grand_total` is also guarded by a CHECK so it cannot disagree with its
  parts even if the trigger were disabled.
- **Bill identity**: `unique (bill_type, bill_number)`; `bill_number_source`
  records `manual` vs `generated`. `bills.vehicle_number` keeps the number as
  written; `vehicle_id`/`trip_id` are real FKs. Party name/address/GSTIN are
  stored on the bill as written.
- **Ledger**: ordered by an identity column (`entry_seq`) under a
  per-customer advisory lock; unique `(transaction_type, reference_id)`
  prevents double-posting; a payment's `(bill_id, customer_id)` is a
  composite FK to the bill, so a payment cannot name another customer.
- **Stock**: `quantity_on_hand` and `stock_movements` are writable only via
  `apply_stock_movement()`; movement direction is checked per type; negative
  stock is never allowed.
- **Measurement sheets** have no FK to bills/quotations/payments/ledger/stock,
  no unit, no formula, and do not enforce `amount = quantity × rate`.

## Concurrency (verified against the function bodies)

- Stock: `select … for update` on the stock item row.
- Ledger: `pg_advisory_xact_lock` per customer + `entry_seq` ordering.
- Document numbers: single atomic `insert … on conflict do update`.
- Payments/bills: the bill row is locked (`for update`) while a payment or a
  ledger post is applied.

## Verification

`npm run test:db` applies the central and business migrations to real
PostgreSQL (PGlite, PG 18) as a non-superuser owner role with
Supabase-equivalent default privileges, and runs the schema, calculation,
NULL-semantics, numbering, ledger, stock, measurement, RLS, grant, function
privilege, audit and KMG-vs-Murudeshwara-identity checks under the same
roles a real API request would use. See `supabase/tests/run.mjs`.
