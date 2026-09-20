# Data entry guide

How to type data into StoneQuarryERP so it is stored correctly. Examples use
obviously fake values.

## The rules that apply everywhere
- **Blank means "not on the document".** Leave a box empty rather than typing 0.
  A blank is stored as NULL and shown as "—". Type 0 only when the paper really says 0.
- **Copy what the paper says.** Bill numbers, measurements and party names are stored
  exactly as typed. Nothing is converted, guessed or recalculated from them.
- **Dates** are picked with the date box and shown as DD-MM-YYYY. Money is in ₹.
- **Draft, then post.** A bill is editable while it is a draft. Posting it puts one
  debit on the customer's ledger and locks it. Corrections after that mean
  cancelling (admin) and entering a new bill.

## Suggested order for a new installation
1. **Settings → Business:** name, address, phone, email, GSTIN (printed on every document).
2. **Settings → Stock → Units:** add only the units the business really uses.
3. **Stock → Material** (admin), then **Stock item**, then an **opening stock** movement.
4. **Customers**, **Vehicles**, **Drivers**.
5. Bills, quotations, measurement sheets, payments as they happen.

## Customer
| Field | Format | Example |
|---|---|---|
| Customer name (required) | as known | Sample Customer |
| Company | optional | Sample Traders |
| Phone / alternate | contact only | 9000000000 |
| GSTIN | 15 characters | 29ABCDE1234F1Z5 |
| Billing address, city, state, pincode | free text | — |

A phone number is contact information only; it never decides who gets money.

## EV Bill (business rule: a bill for stones a customer has paid for, entered by the admin)
1. **Bills → New EV bill.**
2. **Bill number:** choose *Enter existing number* and type the number on the paper,
   or *Generate next number*.
3. **Customer** and **date.** Party name/address/GSTIN fill in from the customer and
   can be edited to match the paper.
4. **Vehicle number** and **E-Way Bill number** if the paper has them.
5. **Lines:** one row per line.
   - Priced line: description, HSN (optional), quantity, rate → amount is quantity × rate.
   - Descriptive line: description only (leave quantity and rate blank).
   - Quantity and rate go together — one without the other is refused.
6. **Tax:** type CGST %, SGST % (or IGST %) exactly as on the paper; leave unused ones blank.
   Discount and other charges are optional.
7. **Save draft → check the totals → Post to ledger.**
8. **Record payment** on the bill (mode, reference no., date). The amount cannot exceed the balance.

Example (fake): number `EV-DEMO-1`, one line "Sample stone", HSN 0000, quantity 10, rate 100
→ amount 1000; CGST 2.5% and SGST 2.5% → total 1050.

## Normal bill
Same screen, "Normal Bill" type. Numbers are unique per type, so a Normal 52 and an EV 52
can both exist.

## Quotation (provisional)
Customer, date, optional "valid until", lines as above, then discount, tax and other
charges **as rupee amounts** (the business's quotation tax rules are not defined yet).
Status: Draft → Sent → Accepted / Rejected.

## Measurement sheet
Header (all optional): sheet number, date, "To" as written, total as written.
Rows: type each cell exactly as written.

| Measurement | PCS | Quantity | Rate | Amount |
|---|---|---|---|---|
| 52 × 18 × 9.5" | M | 78 | 520 | 40560 |

No unit or formula is applied; the screen only shows whether the row amounts add up to the total you typed.

## Stock
- A stock item starts at 0. Change it only with **Add movement**:
  opening stock, purchase, receipt (adds); sale, consumption, damage (reduces);
  adjustment, transfer, processing, return (either way, use − to reduce).
- Stock cannot go below zero. Bills do not change stock by themselves.

## Payment
Customer → (optional) bill → amount → mode (cash, bank transfer, UPI, cheque, other) →
reference no. → date. It is recorded once and cannot be edited or deleted.

## Expense (admin only)
Category, amount, date/time, description, vendor name, payment mode, reference no.

## Vehicle / Driver / Trip
- Vehicle: registration number, type, make/model, assigned driver, capacity, status.
- Driver: name, phone, licence number and expiry.
- Trip: vehicle, driver, customer, date, pickup, destination, load quantity (a plain
  number), status.
