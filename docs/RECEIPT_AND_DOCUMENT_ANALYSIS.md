# Receipt & Document Analysis

Source: two photographed original documents from K M G ENTERPRISES. The
photographs are authoritative; this file records what is legible, what is
not, and what is deliberately **not** concluded.

- **Confirmed** — legible in the photograph.
- **Uncertain** — handwriting or overwriting makes the reading not certain.
- **Blank** — the cell is empty on the paper. A blank is stored as `NULL`,
  never as `0` (see `supabase/migrations/business-template/005_billing.sql`).

> **Correction note.** An earlier transcription of the measurement sheet had
> its rows misaligned. That error has been removed from the repository. Read
> against the photograph, the sheet is internally consistent: every row's
> amount equals quantity × rate, the eight amounts sum to the written total,
> and **no unexplained difference remains**.

---

## Document 1 — Tax Invoice No. 52

| Field | Value | Status |
|---|---|---|
| Document type | TAX INVOICE (pre-printed invoice book) | Confirmed |
| Supplier | K M G ENTERPRISES — Stone Merchants & Building Material Suppliers | Confirmed |
| Printed address | Sy. No. 25/4, 25/6, Chikkagollahalli Village, Kundana H0bali (printed spelling), Devanahalli Taluk – 562110, Bangalore Rural Dist. | Confirmed |
| Printed phones | 9108318319, 9535988986 | Confirmed |
| Printed identifier | Source-document label: **GTIN**. Value: `29HCBPP8901D1ZG`. The value has the shape of a GSTIN, and the database stores such values in GSTIN-compatible fields (`party_gstin`, `settings.business_profile.gstin`) — that interpretation is **pending confirmation**; the document itself says "GTIN". | Confirmed as printed; interpretation pending |
| Invoice No. | 52 | Confirmed |
| Date | 25-01-2026 | Confirmed |
| Vehicle No. | Handwritten registration number | **Uncertain** — not transcribed; not master data |
| E-Way Bill No. | — | Blank |
| Party name/address | Handwritten, only partly legible | **Uncertain** — not transcribed; not customer master data |
| Party GSTIN | — | Blank |
| Line 1 | "Temple stone" · HSN **6802** · Qty **390** · Rate **60** · Amount **23,400** | Confirmed (wording: see note) |
| Line 2 | "Temple cutting" · HSN, Qty, Rate, Amount all blank | Confirmed text; all values Blank |
| Total (taxable) | 23,400 | Confirmed |
| CGST 2.5% | 585 | Confirmed |
| SGST 2.5% | 585 | Confirmed |
| IGST | blank (no % and no amount) | Blank |
| Grand total | **24,570** | Confirmed |
| Payment received / balance | not on the document | Absent |

Note on wording: an intermediate transcription read line 1 as "Temple floor"
and line 2 as "Temple ceiling". The photograph reads "Temple stone" and
"Temple cutting"; the photograph is used.

Arithmetic (all exact): 390 × 60 = 23,400 · 23,400 × 2.5% = 585 ·
23,400 + 585 + 585 = 24,570.

**What this establishes for the schema**
- An invoice carries `CGST %/amount`, `SGST %/amount` and `IGST %/amount` as
  separate values; blank IGST means *not used*, not `0`.
- HSN is per line. A line may exist with **no** quantity, unit, rate or
  amount ("Temple cutting"). The quantity on the invoice has **no unit**.
- The invoice records a vehicle number and an E-Way Bill number field, and
  the party's name/address/GSTIN as written on that document.

---

## Document 2 — Measurement Sheet

A different pre-printed form from the invoice (no GST fields).

| Field | Value | Status |
|---|---|---|
| Supplier | K M G ENTERPRISES | Confirmed |
| "No." | — | Blank |
| "To:" | Handwritten name, partly legible | **Uncertain** — not transcribed as data |
| Date | 01-07-26 (day/month order assumed DD-MM, matching the invoice) | **Uncertain** |
| Total | **2,34,685** (written once double-underlined, and again at "TOTAL") | Confirmed |

| Sl. | Measurement (verbatim) | PCS column | Qty | Rate | Amount |
|---|---|---|---:|---:|---:|
| 1 | 54 × 24 × 09 | M | 108 | 520 | 56,160 |
| 2 | 52 × 18 × 9.5" | M | 78 | 520 | 40,560 |
| 3 | 52 × 18 × 9.5" | M | 78 | 520 | 40,560 |
| 4 | 51 × 18 × 9.5" | M | 76.5 | 520 | 39,780 |
| 5 | 45 × 18 × 12" | M | 67.5 | 550 | 37,125 |
| 6 | 7 × 36 × 08 | approximately ①M (circled digit; hard to read) | 21 | 460 | 9,660 |
| 7 | 7.5 × 12 × 7.25" | 3M | 22.5 | 400 | 9,000 |
| 8 | 3.5 × 15 × 08" | 1M | 4 | 460 | 1,840 |

- The photograph appears to show a small foot mark after the 3.5 on row 8;
  the authoritative dataset omits it, so `3.5 × 15 × 08"` is stored. Nothing
  depends on it.
- **Rates on rows 6 and 8 are overwritten** (a struck-out 480 with 460 written
  over it). 460 is the value now on the paper and the amounts agree with it
  (21 × 460 = 9,660; 4 × 460 = 1,840), so **460 is stored**. The original
  handwriting remains visually uncertain.
- Row 6's PCS text appears to be "①M" in the photograph. It is preserved as
  `①M` and never normalised to plain "M"; the reading is uncertain.
- Every row's amount equals Qty × Rate exactly, and the eight amounts sum to
  **2,34,685**, equal to the written total:
  56,160 + 40,560 + 40,560 + 39,780 + 37,125 + 9,660 + 9,000 + 1,840 = 234,685.

**What is not confirmed (deliberately not modelled)**

The source document records physical dimensions and a Qty value, but the
business formula connecting dimensions to Qty has **not yet been confirmed**.
Also unconfirmed: the meaning of `M`, `①M`, `3M` and `1M`, and the unit of
measure. No formula, unit or PCS interpretation exists in the schema.

---

## The two documents are not connected

| | Total |
|---|---:|
| Tax Invoice No. 52 (incl. CGST + SGST) | ₹24,570 |
| Measurement Sheet | ₹2,34,685 |

The totals differ and nothing on either document links them. They are stored
as independent documents. The schema has **no** foreign key between a
measurement sheet and a bill, quotation, payment, ledger entry or stock
movement, and neither document creates any of those automatically.

## Still open (needs the business)

1. The meaning of the "PCS" column, the unit, and the Qty derivation.
2. Whether a measurement sheet ever leads to a quotation or bill.
3. Party name/address/vehicle number on the photographed documents (not
   needed for the schema, but nothing here is seed data).
4. Whether "Temple cutting" is meant to be priced separately.
