-- ============================================================================
-- Quotations.
--
-- PROVISIONAL: no real quotation document has been supplied yet. The
-- number format, expiry (`valid_until` / 'expired'), tax handling (a single
-- `tax_amount`, no CGST/SGST split) and the status workflow are scaffold
-- defaults, NOT confirmed business rules — see docs/BUSINESS_RULES.md.
-- Only generic arithmetic is enforced: grand_total must equal
-- subtotal - discount + tax + other charges.
--
-- Line values are nullable for the same reason as bill_items: a descriptive
-- line with no quantity/rate/amount is valid, and NULL is not zero.
-- ============================================================================

create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique check (btrim(quotation_number) <> ''),
  customer_id uuid not null references customers (id),
  quotation_date date not null default current_date,
  valid_until date,                          -- provisional
  status text not null default 'draft' check (
    status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')   -- provisional
  ),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(14, 2) not null default 0 check (tax_amount >= 0),
  other_charges numeric(14, 2) not null default 0 check (other_charges >= 0),
  grand_total numeric(14, 2) not null default 0,
  notes text,
  terms text,
  -- Provisional conversion link; the FK to bills is added in 005_billing.sql
  -- once `bills` exists.
  converted_bill_id uuid,
  converted_at timestamptz,
  converted_by uuid references staff_profiles (user_id),
  created_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotation_total_consistent
    check (grand_total = subtotal - discount_amount + tax_amount + other_charges)
);
create trigger trg_quotations_updated_at before update on quotations
  for each row execute function set_updated_at();
create trigger trg_quotations_stamp_created_by before insert on quotations
  for each row execute function stamp_created_by();
create index if not exists idx_quotations_customer on quotations (customer_id);
create index if not exists idx_quotations_status on quotations (status);

create table if not exists quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations (id) on delete cascade,
  material_id uuid references materials (id),
  description text not null check (btrim(description) <> ''),
  hsn_code text,
  quantity numeric(14, 3) check (quantity is null or quantity >= 0),
  unit text references units (code),
  rate numeric(14, 2) check (rate is null or rate >= 0),
  amount numeric(14, 2) check (amount is null or amount >= 0),
  sort_order int not null default 0,
  -- When quantity and rate are both present and an amount is given, the
  -- amount must be their product (to the paisa). A lump-sum line (amount
  -- only) or a descriptive line (nothing) is also valid.
  constraint quotation_item_amount_consistent
    check (quantity is null or rate is null or amount is null or amount = round(quantity * rate, 2))
);
create index if not exists idx_quotation_items_quotation on quotation_items (quotation_id);
