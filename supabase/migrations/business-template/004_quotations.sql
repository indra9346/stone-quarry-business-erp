-- ============================================================================
-- Quotations. Line calculations are validated server-side, not only in the
-- frontend (Rule #9/#42): amount = quantity * rate, with dimension-based
-- quantity computed from length/breadth/height when the material requires it.
-- ============================================================================

create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique,
  customer_id uuid not null references customers (id),
  quotation_date date not null default current_date,
  valid_until date,
  status text not null default 'draft' check (
    status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')
  ),
  subtotal numeric(14, 2) not null default 0,
  discount_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  other_charges numeric(14, 2) not null default 0,
  grand_total numeric(14, 2) not null default 0,
  notes text,
  terms text,
  converted_bill_id uuid,             -- set once converted (Rule #10)
  converted_at timestamptz,
  converted_by uuid references staff_profiles (user_id),
  created_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_quotations_updated_at before update on quotations
  for each row execute function set_updated_at();
create index if not exists idx_quotations_customer on quotations (customer_id);
create index if not exists idx_quotations_status on quotations (status);
create index if not exists idx_quotations_number on quotations (quotation_number);

create table if not exists quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations (id) on delete cascade,
  material_id uuid references materials (id),
  description text not null,
  -- Dimension-based line (nullable — only used when material.is_dimension_based)
  length numeric(10, 3),
  breadth numeric(10, 3),
  height numeric(10, 3),
  pieces numeric(10, 2),               -- e.g. "PCS" column on the measurement sheet
  quantity numeric(14, 3) not null,     -- final billable quantity, always populated
  unit text not null references units (code),
  rate numeric(14, 2) not null,
  line_discount numeric(14, 2) not null default 0,
  line_tax numeric(14, 2) not null default 0,
  amount numeric(14, 2) not null,       -- quantity * rate - line_discount + line_tax
  sort_order int not null default 0
);
create index if not exists idx_quotation_items_quotation on quotation_items (quotation_id);
