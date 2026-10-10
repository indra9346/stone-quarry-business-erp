-- ============================================================================
-- Stone-dimension pricing (client-confirmed formula, 2026-10-10):
--
--   amount = feet x width_in x thickness_in x rate x pieces
--
-- Example given by the client: 16 (feet) x 15 (in) x 3 (in) = 720,
-- 720 x Rs.260/unit = Rs.1,87,200. This is a RAW multiplication of the three
-- typed numbers -- no unit conversion (no /12, /144, /1728). `pieces`
-- (the existing `quantity` column) is an optional multiplier: a line with no
-- pieces entered prices as ONE piece, so the client's own example (which
-- never mentions a piece count) reproduces exactly.
--
-- bill_items/quotation_items previously had only quantity x rate (migrations
-- 004/005). Historical rows were saved under that formula and are NOT
-- rewritten here (Rule: never silently change a saved document's amount).
-- So `amount` must now satisfy ONE of two shapes:
--   dimensioned  : feet, width_in, thickness_in, rate all present ->
--                  amount = round(feet x width_in x thickness_in x rate x coalesce(quantity,1), 2)
--   legacy/plain : feet, width_in, thickness_in all NULL, quantity + rate
--                  present -> amount = round(quantity x rate, 2)   (unchanged)
-- A descriptive line keeps every one of these columns NULL, as before.
-- ============================================================================

alter table bill_items
  add column if not exists feet numeric(10, 3) check (feet is null or feet >= 0),
  add column if not exists width_in numeric(10, 3) check (width_in is null or width_in >= 0),
  add column if not exists thickness_in numeric(10, 3) check (thickness_in is null or thickness_in >= 0);

-- `quantity` (pieces) used to be mandatory alongside rate (migration 005).
-- It now stays mandatory for a LEGACY line with no dimensions (unchanged
-- behaviour), but becomes an OPTIONAL multiplier once dimensions are
-- present -- a dimensioned line with no piece count prices as one piece.
alter table bill_items drop constraint if exists bill_item_financials_together;
alter table bill_items add constraint bill_item_financials_together
  check (
    (rate is null) = (amount is null)
    and (
      (feet is not null and rate is not null)
      or (feet is null and (quantity is null) = (rate is null))
    )
  );

alter table bill_items drop constraint if exists bill_item_amount_consistent;
alter table bill_items add constraint bill_item_dimensions_together
  check ((feet is null) = (width_in is null) and (width_in is null) = (thickness_in is null));
alter table bill_items add constraint bill_item_amount_consistent
  check (
    amount is null
    or (
      feet is not null and width_in is not null and thickness_in is not null and rate is not null
      and amount = round(feet * width_in * thickness_in * rate * coalesce(quantity, 1), 2)
    )
    or (
      feet is null and width_in is null and thickness_in is null and rate is not null and quantity is not null
      and amount = round(quantity * rate, 2)
    )
  );

alter table quotation_items
  add column if not exists feet numeric(10, 3) check (feet is null or feet >= 0),
  add column if not exists width_in numeric(10, 3) check (width_in is null or width_in >= 0),
  add column if not exists thickness_in numeric(10, 3) check (thickness_in is null or thickness_in >= 0);

alter table quotation_items drop constraint if exists quotation_item_financials_together;
alter table quotation_items add constraint quotation_item_financials_together
  check (
    (rate is null) = (amount is null)
    and (
      (feet is not null and rate is not null)
      or (feet is null and (quantity is null) = (rate is null))
    )
  );

alter table quotation_items drop constraint if exists quotation_item_amount_consistent;
alter table quotation_items add constraint quotation_item_dimensions_together
  check ((feet is null) = (width_in is null) and (width_in is null) = (thickness_in is null));
alter table quotation_items add constraint quotation_item_amount_consistent
  check (
    amount is null
    or (
      feet is not null and width_in is not null and thickness_in is not null and rate is not null
      and amount = round(feet * width_in * thickness_in * rate * coalesce(quantity, 1), 2)
    )
    or (
      feet is null and width_in is null and thickness_in is null and rate is not null and quantity is not null
      and amount = round(quantity * rate, 2)
    )
  );
