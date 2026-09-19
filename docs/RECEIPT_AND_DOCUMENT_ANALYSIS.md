# Receipt & Document Analysis

Re-derived directly from the two source images, without carrying forward
the first pass's conclusions unexamined. Every line is marked:

- **CONFIRMED FROM IMAGE** — legible as printed/written, high confidence.
- **INFERRED / NEEDS CONFIRMATION** — my best reading of handwriting that
  is genuinely ambiguous, or a conclusion drawn from the numbers rather
  than read directly. Never treat these as settled business rules.

A third image (the KMG/Murudeshwara sign-in chooser) and two screenshots
(GitHub, Supabase) were also supplied but are UI/tooling screenshots, not
business documents — not analyzed here.

---

## Document 1 — KMG Enterprises Tax Invoice

| Field | Value | Status |
|---|---|---|
| Document type | Tax Invoice (pre-printed multi-part invoice book) | CONFIRMED |
| GTIN | `29HCBPP8901D1ZG` | CONFIRMED |
| Business name | K M G ENTERPRISES | CONFIRMED |
| Business description | "Stone Merchants & Building Material Suppliers" | CONFIRMED |
| Business address | Sy. No. 25/4, 25/6, Chikkagollahalli Village, Kundana Hobali, Devanahalli Taluk – 562110, Bangalore Rural Dist. | CONFIRMED |
| Business phones | 9108318319, 9535988986 | CONFIRMED |
| Invoice No. | 52 | CONFIRMED |
| Date | 25-01-2026 | CONFIRMED |
| Vehicle No. | Handwritten, reads approximately `KA-13-C-6489` | INFERRED — the state-code letters are hard to distinguish from "IU"/"KA" in the handwriting; digits `13`, `C`, `6489` are legible |
| E-Way Bill No. | (left blank) | CONFIRMED |
| Party Address | Line 1 "Shree Anjaneya [Swamy]", line 2 and 3 partially legible, most plausibly "...Temple, Maddur, Mandya" (Maddur is a real taluk in Mandya district, Karnataka) | INFERRED — handwriting on lines 2–3 is not fully legible; do not treat "Maddur" as certain |
| Party GSTIN | (left blank) | CONFIRMED — this customer has no GSTIN on file |
| Line item 1 — Particulars | "Temple Stone" (handwritten, could also read "Tample Stone") | INFERRED (word itself ambiguous but "Temple Stone" is the sensible reading given the customer is a temple) |
| Line item 1 — HSN Code | 6802 | CONFIRMED (6802 = "worked monumental or building stone", a real HSN heading) |
| Line item 1 — Qty | 390 | CONFIRMED |
| Line item 1 — Rate | 60 | CONFIRMED |
| Line item 1 — Amount | 23,400 | CONFIRMED, and arithmetically exact: 390 × 60 = 23,400 |
| Line item 2 — Particulars | "Temple cutting" (a second line under Particulars, no HSN/Qty/Rate/Amount filled in) | CONFIRMED text is present; CONFIRMED that no values were entered for it (blank cells) |
| Subtotal / TOTAL | 23,400 | CONFIRMED |
| CGST | 2.5% → ₹585 | CONFIRMED. 23,400 × 2.5% = 585 exactly |
| SGST | 2.5% → ₹585 | CONFIRMED. 23,400 × 2.5% = 585 exactly |
| IGST | (blank, no % or amount) | CONFIRMED — intra-state supply (CGST+SGST) rather than inter-state (IGST), consistent with an in-state Karnataka delivery |
| Grand Total | 24,570 | CONFIRMED. 23,400 + 585 + 585 = 24,570 exactly |
| Receiver / Proprietor signature | Present as printed labels, no visible signature captured | CONFIRMED (fields exist on the form) |
| Payment status / amount received | Not shown anywhere on this document | CONFIRMED absent — this is a sale invoice, not a payment receipt |

**Business rules this confirms:**
- Tax split is CGST + SGST at equal percentages (2.5% + 2.5% = 5% total)
  for this transaction, not a single flat "GST%" field. → schema's separate
  `cgst_amount`/`sgst_amount`/`igst_amount` columns on `bills` are correct.
- HSN code is tracked per line item/material.
- A line item can exist with **no quantity or amount** ("Temple cutting")
  — i.e. a bill can carry a descriptive line (a cutting/labour charge
  mentioned but not separately priced on this particular document). NEEDS
  CONFIRMATION whether "Temple cutting" was meant to be a separately
  charged line that simply wasn't filled in, or a note.

---

## Document 2 — KMG Enterprises Measurement Sheet

| Field | Value | Status |
|---|---|---|
| Document type | "Measurement Sheet" (a different pre-printed form from the Tax Invoice — no GST fields, no invoice number field filled) | CONFIRMED |
| Business name | K M G ENTERPRISES | CONFIRMED |
| Phones | 9108318319, 9535988986 | CONFIRMED |
| "No." (document number) | Left blank | CONFIRMED |
| "To:" | Handwritten, reads "Nagesh Murudeshwara" (or "Moodeshwara") | INFERRED — could be a customer's personal name that happens to closely resemble the business name "Murudeshwara Stones", or could indicate a real connection between that person and the Murudeshwara business. **Do not assume these are the same entity — needs your confirmation.** |
| Date | Reads approximately "01-07-26" | INFERRED — the day/month order and the last two digits are slightly unclear |
| Row 1 | `54 x 24 x 09` — no PCS, Qty, Rate or Amount filled in | CONFIRMED (dimensions present, all other cells blank — an incomplete/example row) |
| Row 2 | `52 x 18 x 9.5"`, unit column "M", Qty 108, Rate 520, Amount 56,160 | CONFIRMED. 108 × 520 = 56,160 exactly |
| Row 3 | `52 x 18 x 9.5"`, "M", Qty 78, Rate 520, Amount 40,560 | CONFIRMED. 78 × 520 = 40,560 exactly |
| Row 4 | `51 x 18 x 9.5"`, "M", Qty 78, Rate 520, Amount 40,560 | CONFIRMED. 78 × 520 = 40,560 exactly |
| Row 5 | `45 x 18 x 12"`, "M", Qty 76.5, Rate 520, Amount 39,780 | CONFIRMED. 76.5 × 520 = 39,780 exactly |
| Row 6 | `7 x 36 x 08`, "M", Qty 67.5, Rate 550, Amount 37,125 | CONFIRMED. 67.5 × 550 = 37,125 exactly |
| Row 7 | `7.5 x 12 x 7.25"`, unit column shows a circled "③" next to "M", Qty 22.5, Rate 400, Amount 9,000 | CONFIRMED. 22.5 × 400 = 9,000 exactly |
| Row 8 | `3.5 x 15 x 08"`, unit column shows a circled "①" next to "M", Qty 4, Rate **illegible — reads as either 480 or 460**, Amount 1,840 | **NEEDS CONFIRMATION.** If rate = 480: 4 × 480 = 1,920 ≠ 1,840 (does not match). If rate = 460: 4 × 460 = 1,840 (matches exactly). The amount column is the more reliably legible figure, so the rate is most likely 460, not 480 — but do not treat this as confirmed; the earlier pass in this project's `BUSINESS_RULES.md` did not flag this discrepancy and should be treated as unverified until you confirm the actual rate from the original paper. |
| Grand Total | 234,685 (written once, double-underlined, then repeated next to "TOTAL" at the bottom of the page) | CONFIRMED as written. NOTE: summing the eight rows' amounts above (56,160+40,560+40,560+39,780+37,125+9,000+1,840 = 225,025) does **not** equal the stated total of 234,685 — a difference of 9,660. This gap (234,685 − 225,025 = 9,660) is unexplained by the visible line items. It may be caused by: an additional row/amount not fully legible in the image, a rounding/carry-forward from a previous page, or a transcription limit of this analysis. **This must be confirmed against the physical document, not assumed.** |

**What this document confirms about business logic:**
- Stone is priced by **physical dimension** (`Length × Breadth × Height/Thickness`,
  in inches, with feet notation like `52 x 18 x 9.5"`), not by a flat
  per-piece or per-sq.ft rate alone.
- A "PCS"-labeled column holds something other than a simple piece count —
  the values under it ("M", "①M", "③M") look like a *unit code* ("M" =
  possibly "Ft"/meter/measurement-unit abbreviation) combined with a
  circled multiplier, not a literal person-readable label. **The exact
  meaning of the "M" unit and the circled numbers is NOT confirmed** —
  this needs your input, since it directly decides what `materials.default_unit`
  and the dimension→quantity formula should be for cutting-stone type
  materials.
- The `Qty` column is NOT simply `Length × Breadth` or `Length × Breadth ×
  Height` in any single obvious formula that I can reverse-engineer
  confidently from the visible numbers (e.g. row 2: 52 × 18 = 936, or
  52 × 18 × 9.5 = 8,892 — neither equals the stated Qty of 108). The
  relationship between the three dimensions and the final "Qty" column
  is **not confirmed** and should not be hardcoded as a formula in the
  application until you explain how Qty 108 was derived from `52 x 18 x 9.5"`.

## Correction to the previous pass

The scaffold's `BUSINESS_RULES.md` (written before this verification) stated
the dimension arithmetic as settled fact and implied a specific `area`/
`volume` calculation mode without flagging the row 8 rate ambiguity or the
234,685 vs 225,025 total discrepancy above. Both are now called out here
and must be resolved with you before any dimension-to-quantity formula is
encoded as a default in `materials.dimension_calculation`.

## What remains genuinely open

1. Exact meaning of the "M" / circled-number unit column.
2. The formula that turns `(Length, Breadth, Height)` into the `Qty` column.
3. Row 8's true rate (460 vs 480) and the ₹9,660 gap in the measurement
   sheet's total.
4. Whether "Nagesh Murudeshwara" (a person) is connected to the
   "Murudeshwara Stones" business entity, or an unrelated customer.
5. Whether "Temple cutting" on the tax invoice was meant to carry its own
   quantity/rate/amount that simply wasn't filled in on this copy.

None of these are assumed or hardcoded in the schema — see
`BUSINESS_RULES.md` "Open questions" for how each maps to a configurable
field rather than a fixed rule.
