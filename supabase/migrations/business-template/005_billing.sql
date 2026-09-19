-- ============================================================================
-- Billing: two configurable bill types, EV Bill and Normal Bill (spec #11).
-- The exact legal/field difference between them was NOT specified by the
-- customer, so `bill_type` plus a flexible `extra_fields` jsonb column keep
-- this configurable rather than hardcoding an assumption — see
-- BUSINESS_RULES.md "Open Questions".
-- ============================================================================

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  bill_number text not null unique,
  bill_type text not null check (bill_type in ('normal', 'ev')),
  customer_id uuid not null references customers (id),
  quotation_id uuid references quotations (id),
  bill_date date not null default current_date,
  subtotal numeric(14, 2) not null default 0,
  discount_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  cgst_amount numeric(14, 2) not null default 0,
  sgst_amount numeric(14, 2) not null default 0,
  igst_amount numeric(14, 2) not null default 0,
  other_charges numeric(14, 2) not null default 0,
  grand_total numeric(14, 2) not null default 0,
  amount_received numeric(14, 2) not null default 0,
  balance_due numeric(14, 2) generated always as (grand_total - amount_received) stored,
  payment_status text not null default 'unpaid' check (
    payment_status in ('unpaid', 'partially_paid', 'paid', 'overpaid')
  ),
  status text not null default 'active' check (status in ('active', 'cancelled', 'void')),
  vehicle_id uuid,
  trip_id uuid,
  notes text,
  extra_fields jsonb not null default '{}'::jsonb,
  created_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_bills_updated_at before update on bills
  for each row execute function set_updated_at();
create index if not exists idx_bills_customer on bills (customer_id);
create index if not exists idx_bills_number on bills (bill_number);
create index if not exists idx_bills_status on bills (payment_status);
create index if not exists idx_bills_date on bills (bill_date);

create table if not exists bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills (id) on delete cascade,
  material_id uuid references materials (id),
  description text not null,
  length numeric(10, 3),
  breadth numeric(10, 3),
  height numeric(10, 3),
  pieces numeric(10, 2),
  quantity numeric(14, 3) not null,
  unit text not null references units (code),
  rate numeric(14, 2) not null,
  line_discount numeric(14, 2) not null default 0,
  line_tax numeric(14, 2) not null default 0,
  amount numeric(14, 2) not null,
  stock_item_id uuid references stock_items (id),
  sort_order int not null default 0
);
create index if not exists idx_bill_items_bill on bill_items (bill_id);

-- Recomputes payment_status from grand_total vs amount_received whenever
-- either changes, so status can never silently drift out of sync
-- (Rule #11/#42).
create or replace function sync_bill_payment_status()
returns trigger language plpgsql as $$
begin
  if new.amount_received <= 0 then
    new.payment_status := 'unpaid';
  elsif new.amount_received < new.grand_total then
    new.payment_status := 'partially_paid';
  elsif new.amount_received = new.grand_total then
    new.payment_status := 'paid';
  else
    new.payment_status := 'overpaid';
  end if;
  return new;
end;
$$;
create trigger trg_bills_sync_status before insert or update of amount_received, grand_total on bills
  for each row execute function sync_bill_payment_status();
