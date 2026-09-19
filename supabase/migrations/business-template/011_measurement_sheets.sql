-- ============================================================================
-- Measurement sheets — an INDEPENDENT source document (its own pre-printed
-- form), stored exactly as written.
--
-- Deliberately NOT modelled (the business has not confirmed any of it):
--   * what the "PCS" column values mean ("M", "3M", "①M") -> pcs_text, verbatim
--   * any unit of measure                                  -> no unit column
--   * any length x breadth x height -> quantity formula     -> none; the
--     measurement is free text and quantity is whatever was written
--   * amount = quantity x rate                              -> NOT enforced
--   * any link to a bill, quotation, payment, ledger entry or stock movement
--     -> there is no foreign key in either direction; the sheet is
--     self-contained until the business defines a workflow.
--
-- Every value below except the identifiers is nullable, because a blank cell
-- on the paper is NULL, not zero.
-- ============================================================================

create table if not exists measurement_sheets (
  id uuid primary key default gen_random_uuid(),
  sheet_number text,                         -- the form's "No." (often blank)
  sheet_date date,
  customer_id uuid references customers (id),
  party_name_text text,                      -- the "To:" line as written
  stated_total numeric(14, 2),               -- the total written on the sheet
  notes text,
  created_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_measurement_sheets_updated_at before update on measurement_sheets
  for each row execute function set_updated_at();
create trigger trg_measurement_sheets_stamp_created_by before insert on measurement_sheets
  for each row execute function stamp_created_by();
create index if not exists idx_measurement_sheets_date on measurement_sheets (sheet_date);
create index if not exists idx_measurement_sheets_customer on measurement_sheets (customer_id);

create table if not exists measurement_sheet_rows (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references measurement_sheets (id) on delete cascade,
  row_no int not null,                       -- the form's "Sl. No."
  measurement_text text not null check (btrim(measurement_text) <> ''),  -- verbatim, e.g. 52 x 18 x 9.5"
  pcs_text text,                             -- verbatim "PCS" column
  quantity numeric(14, 3),
  rate numeric(14, 2),
  amount numeric(14, 2),
  sort_order int not null default 0,
  constraint measurement_rows_unique_no unique (sheet_id, row_no)
);
create index if not exists idx_measurement_rows_sheet on measurement_sheet_rows (sheet_id, sort_order);

-- Arithmetic VERIFICATION only — never written back, never enforced. It
-- reports the sum of the row amounts next to the stated total, and how many
-- rows' written amount differs from quantity x rate, so a transcription
-- slip is visible without the database deciding what the numbers "mean".
create or replace view measurement_sheet_verification
with (security_invoker = true) as
select
  s.id as sheet_id,
  s.sheet_number,
  s.stated_total,
  count(r.id) as row_count,
  sum(r.amount) as rows_amount_sum,
  s.stated_total - sum(r.amount) as difference,
  count(*) filter (
    where r.quantity is not null and r.rate is not null and r.amount is not null
      and r.amount <> round(r.quantity * r.rate, 2)
  ) as rows_where_amount_differs_from_qty_x_rate
from measurement_sheets s
left join measurement_sheet_rows r on r.sheet_id = s.id
group by s.id;

-- Privileges + RLS. Staff and admin both have full access, mirroring the
-- other operational documents; the business has not said otherwise.
grant select, insert, update, delete on measurement_sheets, measurement_sheet_rows to authenticated;
grant select on measurement_sheet_verification to authenticated;
alter table measurement_sheets enable row level security;
alter table measurement_sheet_rows enable row level security;
create policy "staff full access measurement sheets" on measurement_sheets for all
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "staff full access measurement rows" on measurement_sheet_rows for all
  to authenticated using (is_active_staff()) with check (is_active_staff());
