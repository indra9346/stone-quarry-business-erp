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

Two real KMG Enterprises documents were used to shape the schema:

1. **Tax Invoice #52** (25-01-2026) — GTIN `29HCBPP8901D1ZG`, HSN `6802`
   (worked monumental/building stone), line item "Temple Stone", qty 390,
   rate ₹60, subtotal ₹23,400, **CGST 2.5% (₹585) + SGST 2.5% (₹585)**,
   grand total ₹24,570. → confirms the `bills`/`bill_items` CGST/SGST split
   and `materials.hsn_code` field, and that `tax_defaults` should default to
   2.5%/2.5% (see `settings` seed row) rather than a single flat GST%.
2. **Measurement Sheet** (to "Nagesh Murudeshwara", 01-07-26) — stone
   priced by **dimension** (`L x W x H`, e.g. `52 x 18 x 9.5"`), a `PCS`
   unit column, computed `Qty` and `Amount = Qty × Rate`. → confirms
   `quotation_items`/`bill_items` need `length`/`breadth`/`height`/`pieces`
   columns feeding a computed `quantity`, and `materials.is_dimension_based`
   + `dimension_calculation` (`area` vs `volume`) rather than one hardcoded
   formula (Rule #16).

These are reference examples for schema shape, not a confirmed universal
formula — see open question below on exact dimension → quantity conversion.

## Open questions (need your confirmation before Phase 6 builds the UI)

| # | Question | Current default (safe, configurable) |
|---|---|---|
| 1 | Exact difference between **EV Bill** and **Normal Bill** — different tax treatment? Different customer type? Different numbering only? | `bills.bill_type` enum (`normal`/`ev`) + `extra_fields jsonb` for anything EV-specific once defined. No business rule assumed. |
| 2 | Dimension → quantity conversion formula: is it always `(L × W)/144` for sq.ft from inches, or a different constant? The measurement sheet's own numbers don't cleanly reduce to a single documented formula from the fields alone. | `dimension_calculation` = `area` or `volume`; the actual multiplier/unit conversion is a `materials`-level setting to confirm with you, not hardcoded. |
| 3 | **Payment routing** ("whose mobile number is added, the money should transfer") — read as: each business receives payment into **its own** UPI/mobile number, not the customer's. Confirm this is right, and confirm KMG's and Murudeshwara's actual UPI VPA/mobile numbers to store in `settings.payment_identifiers`. | `settings.payment_identifiers` per business (empty until you provide real values); `customers.preferred_payment_mobile` is informational only and never used as a receiving account. |
| 4 | Stock valuation / "profit" reporting — do you want cost-basis tracked per stock item (needed for real profit, not just revenue − expenses)? | Not implemented yet; `stock_movements` tracks quantity only, no cost field, until confirmed (Rule #39 — "do not claim profit without sufficient cost data"). |
| 5 | Should **Staff** be allowed to record payments at all (spec lists Staff modules without Payments, but taking payment at time of sale is common in this business)? | Current RLS allows Staff to insert/read `payments` but blocks all `customer_ledger` read access — revisit if you want Payments fully Admin-only too. |
| 6 | Low-stock thresholds, expense categories beyond the listed defaults, GST rate beyond 2.5/2.5 for other states/IGST cases. | All configurable via `settings`/`materials.low_stock_threshold`, defaults seeded, no hardcoded assumption blocking later change. |

## Technical decisions

- **Separate Supabase project per business**, not a shared table with
  `business_id` — see `ARCHITECTURE.md` §2 for the full rationale.
- Money stored as `numeric(14,2)`, never floating point.
- Stock, ledger and document numbers are only ever mutated through
  SQL functions (`apply_stock_movement`, `append_ledger_entry`,
  `record_payment`, `next_document_number`) — never direct table writes —
  so concurrency and consistency hold under multiple simultaneous staff
  (Rule #43).

## Roadmap (phased, per spec rule #99 — do not build everything blindly at once)

- [x] Phase 1 — Audit (empty repo, greenfield)
- [x] Phase 2 — Architecture (`ARCHITECTURE.md`)
- [x] Phase 3 — Database (migrations for central + business-template)
- [ ] Phase 4 — Authentication wiring against a real Supabase project (code is ready in `src/features/auth/`; needs real project credentials — see README "Setting up the databases")
- [ ] Phase 5 — Design system components (tables, forms, modals, toasts)
- [ ] Phase 6 — Core modules UI: Customers → Materials/Stock → Quotations → Bills → Payments → Ledger → Vehicles/Drivers/Trips → Expenses → Reports → Settings → Audit logs
- [ ] Phase 7 — Integration tests across modules (quotation→bill→stock→ledger→payment)
- [ ] Phase 8 — PDF/print documents
- [ ] Phase 9 — Performance pass
- [ ] Phase 10 — Security review
- [ ] Phase 11 — Testing (unit/integration/permission/E2E)
