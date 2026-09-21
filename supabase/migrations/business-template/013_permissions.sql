-- ============================================================================
-- 013 - Per-person permissions.
--
-- Until now the role (admin / staff) alone decided access. This adds an
-- OPTIONAL per-person override, decided by an admin, per module:
--     'none'  no access      'view'  read only      'edit'  read and write
-- staff_profiles.permissions is a JSON object such as
--     {"bills":"view","customers":"edit","ledger":"view"}
-- A module that is not listed, and a NULL permissions value, fall back to the
-- role default - exactly the behaviour before this migration:
--     staff:  bills, quotations, measurements, customers, payments, stock,
--             vehicles, drivers, trips = edit;  ledger, expenses, reports = none
--     admin:  everything (permissions are ignored for admins)
-- Settings, audit logs and staff management always stay admin-only.
--
-- Enforcement is in the database (RLS policies and the SECURITY DEFINER
-- functions), not in the menu. Nothing about totals, ledger rules, stock
-- movements or immutability changes; the function bodies below are copied
-- from 002/003/006 with ONLY the permission check replaced.
--
-- Lookups: a person who may work with bills/payments/etc. must still be able to
-- pick a customer, vehicle or driver, so those tables are readable when ANY of
-- the modules that use them is at least 'view'.
-- ============================================================================

alter table staff_profiles add column if not exists permissions jsonb;

create or replace function permissions_valid(p jsonb)
returns boolean
language sql immutable
set search_path = pg_catalog, pg_temp
as $$
  select jsonb_typeof(p) = 'object' and not exists (
    select 1 from jsonb_each(p) e
    where e.key not in ('bills','quotations','measurements','customers','payments','stock',
                        'vehicles','drivers','trips','ledger','expenses','reports')
       or jsonb_typeof(e.value) <> 'string'
       or (e.value #>> '{}') not in ('none','view','edit')
  );
$$;

alter table staff_profiles add constraint staff_permissions_valid
  check (permissions is null or permissions_valid(permissions));

create or replace function can_access(p_module text, p_need text default 'view')
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select coalesce((
    select case
      when p_module not in ('bills','quotations','measurements','customers','payments','stock',
                        'vehicles','drivers','trips','ledger','expenses','reports') then false
      when sp.role = 'admin' then true
      else case coalesce(sp.permissions ->> p_module,
                         case when p_module in ('ledger','expenses','reports') then 'none' else 'edit' end)
             when 'edit' then true
             when 'view' then p_need = 'view'
             else false
           end
    end
    from staff_profiles sp
    where sp.user_id = auth.uid() and sp.status = 'active'
  ), false);
$$;

create or replace function can_access_any(p_modules text[], p_need text default 'view')
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (select 1 from unnest(p_modules) m where can_access(m, p_need));
$$;

revoke execute on function can_access(text, text) from public, anon;
revoke execute on function can_access_any(text[], text) from public, anon;
grant execute on function can_access(text, text) to authenticated;
grant execute on function can_access_any(text[], text) to authenticated;
-- Evaluated by the CHECK constraint under the writing user, so signed-in users need it.
revoke execute on function permissions_valid(jsonb) from public, anon;
grant execute on function permissions_valid(jsonb) to authenticated;

-- Functions: same bodies as before, permission check replaced. (create or replace
-- keeps their existing grants.)
create or replace function apply_stock_movement(
  p_stock_item_id uuid,
  p_movement_type text,
  p_quantity_change numeric,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reason text default null
) returns stock_movements
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_prev numeric;
  v_new numeric;
  v_row stock_movements;
begin
  if not can_access('stock', 'edit') then
    raise exception 'Not authorized to move stock';
  end if;

  select quantity_on_hand into v_prev from stock_items where id = p_stock_item_id for update;
  if v_prev is null then
    raise exception 'Stock item % not found', p_stock_item_id;
  end if;

  v_new := v_prev + p_quantity_change;
  if v_new < 0 then
    raise exception 'Insufficient stock: have %, requested change %', v_prev, p_quantity_change;
  end if;

  insert into stock_movements (
    stock_item_id, movement_type, quantity_change, previous_quantity,
    new_quantity, reference_type, reference_id, reason, performed_by
  ) values (
    p_stock_item_id, p_movement_type, p_quantity_change, v_prev,
    v_new, p_reference_type, p_reference_id, p_reason, auth.uid()
  ) returning * into v_row;

  update stock_items set quantity_on_hand = v_new where id = p_stock_item_id;

  return v_row;
end;
$$;

create or replace function next_document_number(
  p_document_type text,
  p_prefix text,
  p_year int default extract(year from (now() at time zone 'Asia/Kolkata'))::int,
  p_padding int default 6
) returns text
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_next int;
begin
  if not can_access(case p_document_type when 'quotation' then 'quotations' when 'normal_bill' then 'bills' when 'ev_bill' then 'bills' when 'payment' then 'payments' when 'trip' then 'trips' when 'expense' then 'expenses' else 'bills' end, 'edit') then
    raise exception 'Not authorized to generate document numbers';
  end if;
  if p_prefix is null or btrim(p_prefix) = '' then
    raise exception 'A document number prefix is required';
  end if;

  insert into document_sequences (document_type, year, prefix, last_number)
  values (p_document_type, p_year, p_prefix, 1)
  on conflict (document_type, year)
  do update set last_number = document_sequences.last_number + 1
  returning last_number into v_next;

  return p_prefix || '-' || p_year || '-' || lpad(v_next::text, p_padding, '0');
end;
$$;

create or replace function post_bill_to_ledger(p_bill_id uuid)
returns numeric
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_bill bills;
  v_balance numeric;
begin
  if not can_access('bills', 'edit') then
    raise exception 'Not authorized to post bills to the ledger';
  end if;

  select * into v_bill from bills where id = p_bill_id for update;
  if not found then
    raise exception 'Bill % not found', p_bill_id;
  end if;
  if v_bill.status <> 'active' then
    raise exception 'Bill % is % and cannot be posted', v_bill.bill_number, v_bill.status;
  end if;
  if v_bill.ledger_posted_at is not null then
    raise exception 'Bill % is already posted to the ledger', v_bill.bill_number;
  end if;
  if v_bill.grand_total <= 0 then
    raise exception 'Bill % has no chargeable total to post', v_bill.bill_number;
  end if;

  v_balance := append_ledger_entry(
    v_bill.customer_id, 'bill', 'bill', v_bill.id,
    'Bill ' || v_bill.bill_number,
    v_bill.grand_total, 0, v_bill.bill_date
  );
  update bills set ledger_posted_at = now() where id = v_bill.id;
  return v_balance;
end;
$$;

create or replace function record_payment(
  p_customer_id uuid,
  p_bill_id uuid,
  p_amount numeric,
  p_payment_mode text,
  p_reference_number text default null,
  p_notes text default null,
  p_payment_date date default (now() at time zone 'Asia/Kolkata')::date,
  p_idempotency_key text default null
) returns payments
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_bill bills;
  v_customer uuid := p_customer_id;
  v_prefix text;
  v_payment payments;
begin
  if not can_access('payments', 'edit') then
    raise exception 'Not authorized to record payments';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;
  p_payment_date := coalesce(p_payment_date, (now() at time zone 'Asia/Kolkata')::date);

  -- Retried submission: the same key returns the payment already recorded
  -- (no second payment, no second ledger credit).
  if p_idempotency_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 1));
    select * into v_payment from payments where idempotency_key = p_idempotency_key;
    if found then
      if v_payment.amount <> p_amount or v_payment.bill_id is distinct from p_bill_id then
        raise exception 'Idempotency key % was already used for a different payment', p_idempotency_key;
      end if;
      return v_payment;
    end if;
  end if;

  if p_bill_id is not null then
    select * into v_bill from bills where id = p_bill_id for update;
    if not found then
      raise exception 'Bill % not found', p_bill_id;
    end if;
    if v_customer is not null and v_customer <> v_bill.customer_id then
      raise exception 'Bill % does not belong to the given customer', v_bill.bill_number;
    end if;
    v_customer := v_bill.customer_id;
    if v_bill.status <> 'active' then
      raise exception 'Bill % is % and cannot receive payments', v_bill.bill_number, v_bill.status;
    end if;
    if v_bill.ledger_posted_at is null then
      raise exception 'Bill % must be posted to the ledger before a payment is recorded against it', v_bill.bill_number;
    end if;
    if p_amount > v_bill.balance_due then
      raise exception 'Payment % exceeds the balance due % on bill %', p_amount, v_bill.balance_due, v_bill.bill_number;
    end if;
  elsif v_customer is null then
    raise exception 'A customer or a bill is required';
  end if;

  select coalesce(value ->> 'payment', 'PAY') into v_prefix from settings where key = 'document_prefixes';
  v_prefix := coalesce(v_prefix, 'PAY');

  insert into payments (
    payment_number, customer_id, bill_id, payment_date, amount,
    payment_mode, reference_number, idempotency_key, notes, recorded_by
  ) values (
    next_document_number('payment', v_prefix), v_customer, p_bill_id, p_payment_date, p_amount,
    p_payment_mode, p_reference_number, p_idempotency_key, p_notes, auth.uid()
  ) returning * into v_payment;

  if p_bill_id is not null then
    update bills set amount_received = amount_received + p_amount where id = p_bill_id;
  end if;

  perform append_ledger_entry(
    v_customer, 'payment', 'payment', v_payment.id,
    'Payment ' || v_payment.payment_number, 0, p_amount, p_payment_date
  );

  return v_payment;
end;
$$;


-- ---------------------------------------------------------------------------
-- Policies: replace the blanket "any active staff" rules with per-module ones.
-- ---------------------------------------------------------------------------
drop policy if exists "staff full access customers" on customers;
drop policy if exists "staff full access quotations" on quotations;
drop policy if exists "staff full access quotation items" on quotation_items;
drop policy if exists "staff full access drivers" on drivers;
drop policy if exists "staff full access vehicles" on vehicles;
drop policy if exists "staff full access trips" on trips;
drop policy if exists "staff read stock" on stock_items;
drop policy if exists "staff create stock items" on stock_items;
drop policy if exists "staff relabel stock items" on stock_items;
drop policy if exists "staff read stock movements" on stock_movements;
drop policy if exists "staff read bills" on bills;
drop policy if exists "staff create bills" on bills;
drop policy if exists "staff edit bills" on bills;
drop policy if exists "staff full access bill items" on bill_items;
drop policy if exists "staff read payments" on payments;
drop policy if exists "admin only reads ledger" on customer_ledger;
drop policy if exists "admin only expenses" on expenses;
drop policy if exists "staff full access measurement sheets" on measurement_sheets;
drop policy if exists "staff full access measurement rows" on measurement_sheet_rows;

create policy "module customers read" on customers for select to authenticated
  using (can_access_any(array['customers','bills','quotations','payments','measurements','trips','ledger'], 'view'));
create policy "module customers insert" on customers for insert to authenticated
  with check (can_access('customers', 'edit'));
create policy "module customers update" on customers for update to authenticated
  using (can_access('customers', 'edit')) with check (can_access('customers', 'edit'));
create policy "module customers delete" on customers for delete to authenticated
  using (can_access('customers', 'edit'));
create policy "module quotations read" on quotations for select to authenticated
  using (can_access_any(array['quotations'], 'view'));
create policy "module quotations insert" on quotations for insert to authenticated
  with check (can_access('quotations', 'edit'));
create policy "module quotations update" on quotations for update to authenticated
  using (can_access('quotations', 'edit')) with check (can_access('quotations', 'edit'));
create policy "module quotations delete" on quotations for delete to authenticated
  using (can_access('quotations', 'edit'));
create policy "module quotation items read" on quotation_items for select to authenticated
  using (can_access_any(array['quotations'], 'view'));
create policy "module quotation items insert" on quotation_items for insert to authenticated
  with check (can_access('quotations', 'edit'));
create policy "module quotation items update" on quotation_items for update to authenticated
  using (can_access('quotations', 'edit')) with check (can_access('quotations', 'edit'));
create policy "module quotation items delete" on quotation_items for delete to authenticated
  using (can_access('quotations', 'edit'));
create policy "module drivers read" on drivers for select to authenticated
  using (can_access_any(array['drivers','trips','vehicles'], 'view'));
create policy "module drivers insert" on drivers for insert to authenticated
  with check (can_access('drivers', 'edit'));
create policy "module drivers update" on drivers for update to authenticated
  using (can_access('drivers', 'edit')) with check (can_access('drivers', 'edit'));
create policy "module drivers delete" on drivers for delete to authenticated
  using (can_access('drivers', 'edit'));
create policy "module vehicles read" on vehicles for select to authenticated
  using (can_access_any(array['vehicles','trips','bills'], 'view'));
create policy "module vehicles insert" on vehicles for insert to authenticated
  with check (can_access('vehicles', 'edit'));
create policy "module vehicles update" on vehicles for update to authenticated
  using (can_access('vehicles', 'edit')) with check (can_access('vehicles', 'edit'));
create policy "module vehicles delete" on vehicles for delete to authenticated
  using (can_access('vehicles', 'edit'));
create policy "module trips read" on trips for select to authenticated
  using (can_access_any(array['trips'], 'view'));
create policy "module trips insert" on trips for insert to authenticated
  with check (can_access('trips', 'edit'));
create policy "module trips update" on trips for update to authenticated
  using (can_access('trips', 'edit')) with check (can_access('trips', 'edit'));
create policy "module trips delete" on trips for delete to authenticated
  using (can_access('trips', 'edit'));
create policy "module stock items read" on stock_items for select to authenticated
  using (can_access_any(array['stock','bills','quotations'], 'view'));
create policy "module stock items insert" on stock_items for insert to authenticated
  with check (can_access('stock', 'edit'));
create policy "module stock items update" on stock_items for update to authenticated
  using (can_access('stock', 'edit')) with check (can_access('stock', 'edit'));
create policy "module stock movements read" on stock_movements for select to authenticated
  using (can_access('stock', 'view'));
create policy "module bills read" on bills for select to authenticated
  using (can_access_any(array['bills','payments','ledger'], 'view'));
create policy "module bills insert" on bills for insert to authenticated
  with check (can_access('bills', 'edit'));
create policy "module bills update" on bills for update to authenticated
  using (can_access('bills', 'edit')) with check (can_access('bills', 'edit'));
create policy "module bill items read" on bill_items for select to authenticated
  using (can_access_any(array['bills','payments'], 'view'));
create policy "module bill items insert" on bill_items for insert to authenticated
  with check (can_access('bills', 'edit'));
create policy "module bill items update" on bill_items for update to authenticated
  using (can_access('bills', 'edit')) with check (can_access('bills', 'edit'));
create policy "module bill items delete" on bill_items for delete to authenticated
  using (can_access('bills', 'edit'));
create policy "module payments read" on payments for select to authenticated
  using (can_access_any(array['payments','bills','ledger'], 'view'));
create policy "module ledger read" on customer_ledger for select to authenticated
  using (can_access('ledger', 'view'));
create policy "module expenses read" on expenses for select to authenticated
  using (can_access_any(array['expenses'], 'view'));
create policy "module expenses insert" on expenses for insert to authenticated
  with check (can_access('expenses', 'edit'));
create policy "module expenses update" on expenses for update to authenticated
  using (can_access('expenses', 'edit')) with check (can_access('expenses', 'edit'));
create policy "module expenses delete" on expenses for delete to authenticated
  using (can_access('expenses', 'edit'));
create policy "module measurement sheets read" on measurement_sheets for select to authenticated
  using (can_access_any(array['measurements'], 'view'));
create policy "module measurement sheets insert" on measurement_sheets for insert to authenticated
  with check (can_access('measurements', 'edit'));
create policy "module measurement sheets update" on measurement_sheets for update to authenticated
  using (can_access('measurements', 'edit')) with check (can_access('measurements', 'edit'));
create policy "module measurement sheets delete" on measurement_sheets for delete to authenticated
  using (can_access('measurements', 'edit'));
create policy "module measurement rows read" on measurement_sheet_rows for select to authenticated
  using (can_access_any(array['measurements'], 'view'));
create policy "module measurement rows insert" on measurement_sheet_rows for insert to authenticated
  with check (can_access('measurements', 'edit'));
create policy "module measurement rows update" on measurement_sheet_rows for update to authenticated
  using (can_access('measurements', 'edit')) with check (can_access('measurements', 'edit'));
create policy "module measurement rows delete" on measurement_sheet_rows for delete to authenticated
  using (can_access('measurements', 'edit'));
