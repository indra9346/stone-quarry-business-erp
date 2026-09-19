# Business Rules, Assumptions & Open Questions

Living document. Update this whenever an ambiguity is resolved or a new
assumption is made — never bury an assumption silently inside code
(spec rule #97).

## Confirmed rules

- Two initial businesses: **KMG Stones** (legal name KMG Enterprises) and
  **Murudeshwara Stones**. Each fully data-isolated (own Supabase project).
- Two roles per business: **Admin** (full access) and **Staff** (no
  Customer Ledger, no Expenses).
- Currency: INR (₹), GST-aware (CGST/SGST/IGST fields on bills), configurable.
- Business timezone default: `Asia/Kolkata`.
- Document numbering format: `<PREFIX>-<YEAR>-<NNNNNN>`, prefixes
  configurable per business (defaults: KMG → `KMG-QT/INV/EV/PAY/TRP/EXP`,
  Murudeshwara → `MDS-QT/INV/EV/PAY/TRP/EXP`).

## Evidence from the sample invoices provided

Full re-analysis, with exact confidence markers per field, now lives in
[`RECEIPT_AND_DOCUMENT_ANALYSIS.md`](./RECEIPT_AND_DOCUMENT_ANALYSIS.md).
Summary of what that document CONFIRMS:

1. **Tax Invoice #52** (25-01-2026) — HSN `6802`, line item "Temple Stone",
   qty 390, rate ₹60, subtotal ₹23,400, **CGST 2.5% (₹585) + SGST 2.5%
   (₹585)**, grand total ₹24,570 — all arithmetically exact. Confirms the
   `bills`/`bill_items` CGST/SGST split, `materials.hsn_code`, and a
   2.5%/2.5% tax default.
2. **Measurement Sheet** (to "Nagesh Murudeshwara", 01-07-26) — stone
   priced by **dimension** (`L x W x H`, e.g. `52 x 18 x 9.5"`), a unit
   column, a computed `Qty`, and `Amount = Qty × Rate` (confirmed exact for
   6 of 8 rows). Confirms the general shape (`length`/`breadth`/`height`
   feeding a computed `quantity`) but **NOT** a specific dimension→quantity
   formula — see the analysis doc for two unresolved discrepancies found
   during this review (an unreadable rate on row 8, and the sheet's stated
   total not matching the sum of its own visible line items).

These remain reference examples for schema shape, not a confirmed universal
formula.

## Open questions (need your confirmation before Phase 6 builds the UI)

| # | Question | Current default (safe, configurable) |
|---|---|---|
| 1 | Exact difference between **EV Bill** and **Normal Bill**. See `EV_VS_NORMAL_BILL.md` below for the full breakdown of what's known/unknown. | `bills.bill_type` enum (`normal`/`ev`) + `extra_fields jsonb` for anything EV-specific once defined. No business rule assumed. |
| 2 | Dimension → quantity conversion formula. Re-verified in `RECEIPT_AND_DOCUMENT_ANALYSIS.md`: the measurement sheet's own numbers do NOT cleanly reduce to a single formula I can derive with confidence (e.g. row 2's `52 x 18 x 9.5"` → Qty 108 is not simply L×B, L×B×H, or any obvious unit conversion of those). | `dimension_calculation` = `area` or `volume`; the actual multiplier/unit conversion is a `materials`-level setting to confirm with you, not hardcoded. |
| 3 | **Payment routing**. See "Payment architecture" section below — this is now modeled as 4 distinct concepts (A–D), not one feature. | `settings.payment_identifiers` per business (empty until you provide real values); `customers.preferred_payment_mobile` is informational only and never used as a receiving account. No automatic transfer exists or is planned until you explicitly authorize a provider integration. |
| 4 | Stock valuation / "profit" reporting — do you want cost-basis tracked per stock item (needed for real profit, not just revenue − expenses)? | Not implemented yet; `stock_movements` tracks quantity only, no cost field, until confirmed (Rule #39 — "do not claim profit without sufficient cost data"). |
| 5 | Should **Staff** be allowed to record payments at all (spec lists Staff modules without Payments, but taking payment at time of sale is common in this business)? | Staff can call `record_payment()` (which enforces `is_active_staff()`) but cannot read `customer_ledger` at all — revisit if you want Payments fully Admin-only too. |
| 6 | Low-stock thresholds, expense categories beyond the listed defaults, GST rate beyond 2.5/2.5 for other states/IGST cases. | All configurable via `settings`/`materials.low_stock_threshold`, defaults seeded, no hardcoded assumption blocking later change. |
| 7 | Whether "Nagesh Murudeshwara" (a person, on the measurement sheet) is connected to the "Murudeshwara Stones" business, or an unrelated customer with a coincidentally similar name. | Not assumed either way; `customers` treats them as an ordinary customer record until you say otherwise. |

## Payment architecture (A/B/C/D)

"Whose mobile number is added, the money should transfer to them" is
modeled as four **distinct** concepts, not one feature — conflating them
would risk building an unauthorized money-movement feature:

| | Concept | Status |
|---|---|---|
| A | **Customer payment** — the customer physically pays (cash/UPI/cheque/etc.) | Out of this app's control; happens outside the system |
| B | **Payment recording** — staff logs that a payment happened: amount, method, date, reference number, which bill it's against | ✅ Implemented — `payments` table + `record_payment()` function |
| C | **Payment destination** — which of the business's own accounts (UPI VPA / bank account) the money was meant to land in, recorded for that business's own reporting | ✅ Modeled — `settings.payment_identifiers` (per business) + `payments.received_via_identifier` records which identity was in effect at the time |
| D | **Automatic payout/transfer** — the app itself initiating a real bank/UPI transfer | ❌ **Not implemented, not scaffolded, no code path exists for this.** Will not be built until you explicitly provide: a payment provider, exact flow, merchant/business account details, API requirements, webhook requirements, settlement requirements, and refund requirements. No payment-provider secret key will ever be placed in frontend code. |

Concretely: a business's `settings.payment_identifiers` row lets KMG and
Murudeshwara each configure their own UPI VPA / mobile / bank details
independently (satisfying "each business can have its own payment
destination"). `customers.preferred_payment_mobile` is purely informational
metadata about the customer — it is never read by any function that moves
or records money, and no code treats a customer's phone number as a
receiving account.

## EV Bill vs Normal Bill — what's known / unknown

**Known:** the spec and every business-module listing name two bill types,
"EV Bill" and "Normal Bill", both needing Customer, Product/stone, Qty,
Rate, Amount, Discount, Tax, Total, Date, Print, PDF, Status.

**Unknown (genuinely, from the documents supplied):** neither sample
document is labeled "EV Bill" — the one Tax Invoice provided doesn't say
which type it is. Nothing in the images or requirements explains:
- whether "EV" is a tax/legal category (e.g. an e-way-bill-linked
  transport document) or a different customer segment or delivery mode,
- whether EV Bills need fields Normal Bills don't (or vice versa),
- whether they share the same numbering pool or must stay separate
  (currently kept separate: `EV`/`INV` prefixes).

**What's shared safely today:** `bills.bill_type` (`'normal' | 'ev'`),
all customer/line-item/tax/total columns, `payment_status`, numbering,
PDF generation plumbing.

**What may need to differ, pending your answer:** `bills.extra_fields
jsonb` exists specifically to hold whatever EV-specific fields turn out to
be needed, without a schema migration, once you define them.

**Blocking Phase 6 decision:** the Bills UI's field layout cannot be
finalized until this is answered — building it now would risk guessing
wrong and reworking real user-facing screens.

## Technical decisions

- **Separate Supabase project per business**, not a shared table with
  `business_id` — see [`ARCHITECTURE.md`](./ARCHITECTURE.md) §2 and
  [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md) for the full
  rationale and verification.
- Money stored as `numeric(14,2)`, never floating point.
- Stock, ledger and document numbers are only ever mutated through
  SQL functions (`apply_stock_movement`, `append_ledger_entry`,
  `record_payment`, `next_document_number`) — never direct table writes —
  so concurrency and consistency hold under multiple simultaneous staff
  (Rule #43). These functions are `SECURITY DEFINER` with an explicit
  `is_active_staff()` check inside (see `docs/SECURITY.md` for why this
  was necessary, not optional).

See [`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md) for the phased roadmap.

## Technical decisions

- **Separate Supabase project per business**, not a shared table with
  `business_id` — see `ARCHITECTURE.md` §2 for the full rationale.
- Money stored as `numeric(14,2)`, never floating point.
- Stock, ledger and document numbers are only ever mutated through
  SQL functions (`apply_stock_movement`, `append_ledger_entry`,
  `record_payment`, `next_document_number`) — never direct table writes —
  so concurrency and consistency hold under multiple simultaneous staff
  (Rule #43).

