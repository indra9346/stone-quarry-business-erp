# Business Rules, Assumptions & Open Questions

Living document. Update this whenever an ambiguity is resolved or a new
assumption is made — never bury an assumption silently inside code
(spec rule #97).

## Confirmed rules

- Two initial businesses: **KMG Stones** (legal name KMG Enterprises) and
  **Murudeshwara Stones**. Each fully data-isolated (own Supabase project).
- Two roles per business:
  - **Admin**: Dashboard, Bills, Quotation, Expenses, Customer Ledger,
    Stock / Raw Material, Vehicles.
  - **Staff**: Dashboard, Bills, Quotation, Stock / Raw Material, Vehicles.
    **No** Customer Ledger, **no** Expenses. Enforced in the database (RLS +
    column grants), not only by hiding menu items.
- Currency: INR (₹). Business timezone default: `Asia/Kolkata`.
- **Two bill types**, chosen explicitly: **EV Bill** and **Normal Bill**.
- A **Normal Bill** may carry an **existing physical/manual bill number**
  typed in by the user; generation is never forced. Bill numbers are unique
  per `(bill_type, bill_number)`, so Normal 52 and EV 52 are separate.
- **NULL is not zero.** A blank cell on a source document is stored as
  `NULL` (`0` means an explicit zero). A bill line may have only a
  description ("Temple cutting"). A blank IGST stays `NULL`.
- **Bill arithmetic is derived by the database**, not trusted from the client
  (see below).
- A **measurement sheet** is an independent document, stored verbatim. The source records dimensions and a Qty, but the business formula connecting them is **not confirmed** and is not implemented.
- Payments are **customer payments received**, expenses are **business
  spending**, and the ledger is the running account of bills and payments.
  These stay separate concepts (see "Withdrawn idea" below).

## Bill arithmetic (implemented in `005_billing.sql`)

```
line amount  = quantity × rate            (when both are present)
subtotal     = Σ line amounts             (blank lines contribute nothing)
taxable      = subtotal − discount
CGST/SGST/IGST = round(taxable × percent / 100, 2), or NULL if percent is NULL
grand total  = taxable + CGST + SGST + IGST + other charges
```

Verified on invoice 52: 390 × 60 = 23,400; CGST 585; SGST 585; IGST NULL;
grand total **24,570**. Nothing is hard-coded to that figure. Only "to the
paisa" rounding is assumed; no round-off rule is invented.

After a bill is posted to the ledger, its customer, type, number and total
are frozen; corrections go through `cancel_bill()` or an admin ledger
adjustment.

## Documents provided

Full read-out with confidence markers:
[`RECEIPT_AND_DOCUMENT_ANALYSIS.md`](./RECEIPT_AND_DOCUMENT_ANALYSIS.md).

- **Tax Invoice No. 52** (25-01-2026): total ₹24,570.
- **Measurement Sheet** (01-07-26): total ₹2,34,685; the eight row amounts sum to exactly ₹2,34,685 — no unexplained difference.
- The invoice's printed label is **GTIN** (value `29HCBPP8901D1ZG`); it is stored in GSTIN-compatible fields pending confirmation.
- Uncertain handwritten party text is not customer master data, and the two documents share no customer relationship.

**These are different documents and are not assumed to be the same
transaction.** No foreign key, trigger or function connects a measurement
sheet to a bill, quotation, payment, ledger entry or stock movement.
Neither document is seeded as data.

## Open questions

Only genuinely undecided items.

| # | Question | Current state (nothing invented) |
|---|---|---|
| 1 | **EV Bill**: what "EV" means, its format and fields, and whether its numbers are manual or generated. | `bill_type = 'ev'`; `bills.extra_fields` (jsonb) holds anything EV-specific once defined. Numbering is not assumed. |
| 2 | **Measurement sheet**: meaning of the "PCS" column (`M`, `3M`, `①M`), the unit, and how Qty derives from the dimensions. | `pcs_text` and `measurement_text` stored verbatim; no unit column, no formula, `amount = quantity × rate` not enforced (a verification view reports mismatches). |
| 3 | Whether a measurement sheet ever leads to a quotation or bill. | No link exists. |
| 4 | **Quotation**: format, numbering, tax handling, expiry, statuses. No real quotation has been supplied. | Provisional scaffold (`valid_until`, status list, single `tax_amount`), marked provisional in `004_quotations.sql`. |
| 5 | Whether recording an existing paper bill should also post a ledger debit / affect stock. | Posting is an explicit call (`post_bill_to_ledger`), never automatic. Stock is never moved automatically. |
| 6 | Tax rounding / round-off convention on printed invoices. | Round to the paisa; no round-off field. |
| 7 | Whether a bill may exist without a customer master record (walk-in). | `bills.customer_id` is required (the ledger needs a customer). |
| 8 | **Payment reversal** and **correcting a bill after it is posted**. Not defined by the business. | Before posting, a bill (customer, number, lines, tax) can be freely corrected. After posting it is frozen (customer, type, number, total). The only controlled path today is admin `cancel_bill()` (refuses a bill that has payments; reverses the ledger debit) or an admin ledger adjustment. Cancelling keeps the bill number reserved, so a corrected bill needs a new number. Payments cannot be edited or deleted by any client; a reversal function is a **pending requirement**, not invented. |
| 9 | Units the business uses; low-stock thresholds; expense categories beyond the seeded list. | `units` ships empty; the rest is configurable. |
| 10 | Whether Staff should keep full edit rights on customers, quotations, vehicles, drivers, trips and measurement sheets (they currently do). | Unchanged from the original design. |

## Withdrawn idea — no "person whose number is entered receives the amount"

An earlier design tried to model money being routed to a person because a
phone number was entered against an amount. That has **no business meaning
for this ERP and has been removed everywhere**: `customers.
preferred_payment_mobile`, `payments.received_via_identifier` and the
`payment_identifiers` setting no longer exist, and no function, trigger or
policy reads a phone/mobile number to decide who gets money. The schema
verification (`npm run test:db`) checks for this.

The current model:

| Concept | Where |
|---|---|
| Bill amount (what a customer is charged) | `bills`, `bill_items` |
| Payment received **from a customer** | `payments` (`record_payment()`) |
| Customer ledger (bills − payments = outstanding) | `customer_ledger` |
| Business expense | `expenses` |

There is no automatic payout or transfer of any kind.

## Technical decisions

- **Separate Supabase project per business**, not a shared table with
  `business_id` — see [`ARCHITECTURE.md`](./ARCHITECTURE.md) §2 and
  [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md).
- Money is `numeric(14,2)`, never floating point.
- Stock, ledger, payments, bill totals and document numbers are changed only
  by database functions/triggers (`apply_stock_movement`, `record_payment`,
  `post_bill_to_ledger`, `cancel_bill`, `record_ledger_adjustment`,
  `next_document_number`, `bills_before_write`) — clients hold no write
  privilege on those columns/tables.
- Those functions are `SECURITY DEFINER` with a pinned `search_path` and an
  explicit role check; the acting user is always `auth.uid()`, never a
  caller-supplied id.
