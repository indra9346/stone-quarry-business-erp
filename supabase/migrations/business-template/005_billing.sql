-- ============================================================================
-- Billing. Two bill types, EV Bill and Normal Bill (spec #11):
--
--   * bill_type is explicit: 'normal' | 'ev'.
--   * A Normal Bill may carry an existing physical/manual number typed in by
--     the user (bill_number_source = 'manual'); nothing forces generation.
--   * The EV Bill's exact format is NOT confirmed, so no EV-specific columns
--     exist; `extra_fields` (jsonb) is the only place for them once defined.
--   * Uniqueness is per (bill_type, bill_number): Normal 52 and EV 52 are
--     separate documents.
--
-- MONEY / NULL SEMANTICS
--   NULL = not entered / not present on the source document.
--   0    = explicitly zero.
-- A blank IGST on a CGST+SGST invoice is stored as NULL, never 0. Blank
-- line values (e.g. the "Temple cutting" line on invoice 52) stay NULL.
--
-- TOTALS ARE DERIVED, NEVER TRUSTED FROM THE CLIENT
--   line amount         = quantity x rate (when both are present)
--   subtotal            = sum of line amounts (NULL lines contribute nothing)
--   taxable             = subtotal - discount
--   cgst/sgst/igst      = round(taxable x percent / 100, 2), or NULL if the
--                         percent is NULL
--   grand_total         = taxable + cgst + sgst + igst + other_charges
-- These are computed inside the database (bills_before_write below); the
-- client has no INSERT/UPDATE privilege on them (010_rls_policies.sql). No
-- rounding rule beyond "to the paisa" is assumed — the business has not
-- confirmed one.
-- ============================================================================

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  bill_type text not null check (bill_type in ('normal', 'ev')),
  bill_number text not null check (btrim(bill_number) <> ''),
  -- How the number was obtained: typed from an existing physical bill, or
  -- produced by next_document_number().
  bill_number_source text not null check (bill_number_source in ('manual', 'generated')),
  customer_id uuid not null references customers (id),
  quotation_id uuid references quotations (id),
  bill_date date not null default current_date,

  -- Party details AS WRITTEN on this document (snapshot; later edits to the
  -- customer master must not rewrite an issued bill).
  party_name text,
  party_address text,
  party_gstin text,

  eway_bill_number text,
  vehicle_number text,               -- as written on the document
  vehicle_id uuid,                   -- FK added in 007_transport.sql
  trip_id uuid,                      -- FK added in 007_transport.sql

  cgst_percent numeric(5, 2) check (cgst_percent is null or cgst_percent between 0 and 100),
  sgst_percent numeric(5, 2) check (sgst_percent is null or sgst_percent between 0 and 100),
  igst_percent numeric(5, 2) check (igst_percent is null or igst_percent between 0 and 100),

  -- Derived by bills_before_write(); see header.
  subtotal numeric(14, 2) not null default 0,
  discount_amount numeric(14, 2) check (discount_amount is null or discount_amount >= 0),
  cgst_amount numeric(14, 2),
  sgst_amount numeric(14, 2),
  igst_amount numeric(14, 2),
  tax_amount numeric(14, 2) not null default 0,   -- total of the three above
  other_charges numeric(14, 2) check (other_charges is null or other_charges >= 0),
  grand_total numeric(14, 2) not null default 0,

  -- Maintained ONLY by record_payment() (no client privilege on it).
  amount_received numeric(14, 2) not null default 0 check (amount_received >= 0),
  balance_due numeric(14, 2) generated always as (grand_total - amount_received) stored,
  payment_status text not null default 'unpaid' check (
    payment_status in ('unpaid', 'partially_paid', 'paid', 'overpaid')
  ),

  status text not null default 'active' check (status in ('active', 'cancelled', 'void')),
  -- Set by post_bill_to_ledger(); once set, the bill's amounts and identity
  -- are frozen (see bills_before_write).
  ledger_posted_at timestamptz,

  notes text,
  extra_fields jsonb not null default '{}'::jsonb,
  created_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bills_number_unique_per_type unique (bill_type, bill_number),
  constraint bill_total_consistent check (
    grand_total = subtotal - coalesce(discount_amount, 0)
                  + coalesce(cgst_amount, 0) + coalesce(sgst_amount, 0) + coalesce(igst_amount, 0)
                  + coalesce(other_charges, 0)
  ),
  constraint bill_tax_total_consistent check (
    tax_amount = coalesce(cgst_amount, 0) + coalesce(sgst_amount, 0) + coalesce(igst_amount, 0)
  ),
  constraint bill_discount_within_subtotal check (coalesce(discount_amount, 0) <= subtotal)
);
create index if not exists idx_bills_customer on bills (customer_id);
create index if not exists idx_bills_payment_status on bills (payment_status);
create index if not exists idx_bills_date on bills (bill_date);
create trigger trg_bills_updated_at before update on bills
  for each row execute function set_updated_at();
create trigger trg_bills_stamp_created_by before insert on bills
  for each row execute function stamp_created_by();

-- Real FK for the quotation conversion link (created in 004 as a plain uuid
-- because bills did not exist yet).
alter table quotations
  add constraint quotations_converted_bill_fk foreign key (converted_bill_id) references bills (id);

create table if not exists bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills (id) on delete cascade,
  material_id uuid references materials (id),
  description text not null check (btrim(description) <> ''),
  hsn_code text,
  -- All of these may be NULL: a descriptive-only line (e.g. "Temple cutting"
  -- on invoice 52) is a legitimate line. NULL is never coerced to 0.
  quantity numeric(14, 3) check (quantity is null or quantity >= 0),
  unit text references units (code),
  rate numeric(14, 2) check (rate is null or rate >= 0),
  amount numeric(14, 2) check (amount is null or amount >= 0),
  stock_item_id uuid references stock_items (id),
  sort_order int not null default 0,
  constraint bill_item_amount_consistent
    check (quantity is null or rate is null or amount is null or amount = round(quantity * rate, 2))
);
create index if not exists idx_bill_items_bill on bill_items (bill_id);

-- ---------------------------------------------------------------------------
-- bills_before_write — the single place bill arithmetic and status live.
-- Runs BEFORE INSERT/UPDATE, so whatever the caller supplied for a derived
-- column is overwritten by the value computed from the lines.
-- ---------------------------------------------------------------------------
create or replace function bills_before_write()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_taxable numeric(14, 2);
begin
  if tg_op = 'UPDATE' and old.ledger_posted_at is not null then
    -- A posted bill is what the ledger debited. Its identity and amount are
    -- frozen; corrections go through cancel_bill() / a ledger adjustment.
    if new.customer_id is distinct from old.customer_id
       or new.bill_type is distinct from old.bill_type
       or new.bill_number is distinct from old.bill_number then
      raise exception 'Bill % is posted to the ledger; its customer, type and number cannot change', old.bill_number;
    end if;
    new.ledger_posted_at := old.ledger_posted_at;
  end if;

  select coalesce(sum(amount), 0) into new.subtotal from bill_items where bill_id = new.id;

  v_taxable := new.subtotal - coalesce(new.discount_amount, 0);
  new.cgst_amount := case when new.cgst_percent is null then null else round(v_taxable * new.cgst_percent / 100, 2) end;
  new.sgst_amount := case when new.sgst_percent is null then null else round(v_taxable * new.sgst_percent / 100, 2) end;
  new.igst_amount := case when new.igst_percent is null then null else round(v_taxable * new.igst_percent / 100, 2) end;
  new.tax_amount := coalesce(new.cgst_amount, 0) + coalesce(new.sgst_amount, 0) + coalesce(new.igst_amount, 0);
  new.grand_total := v_taxable + new.tax_amount + coalesce(new.other_charges, 0);

  if tg_op = 'UPDATE' and old.ledger_posted_at is not null
     and new.grand_total is distinct from old.grand_total then
    raise exception 'Bill % is posted to the ledger; its total cannot change (old %, new %)',
      old.bill_number, old.grand_total, new.grand_total;
  end if;

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
create trigger trg_bills_before_write before insert or update on bills
  for each row execute function bills_before_write();

-- Any change to a bill's lines re-derives the bill. SECURITY DEFINER because
-- clients hold no UPDATE privilege on the derived columns of `bills`.
create or replace function bill_items_touch_bill()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_bill_id uuid := case when tg_op = 'DELETE' then old.bill_id else new.bill_id end;
begin
  update bills set updated_at = now() where id = v_bill_id;
  if tg_op = 'UPDATE' and old.bill_id is distinct from new.bill_id then
    update bills set updated_at = now() where id = old.bill_id;
  end if;
  return null;
end;
$$;
create trigger trg_bill_items_touch_bill after insert or update or delete on bill_items
  for each row execute function bill_items_touch_bill();
revoke execute on function bill_items_touch_bill() from public, anon, authenticated;
