-- ============================================================================
-- Payments + Customer Ledger.
--
-- Concepts kept strictly separate:
--   bill      what a customer is charged                (bills)
--   payment   money RECEIVED FROM a customer            (payments)
--   ledger    the running account of the two above      (customer_ledger)
--   expense   money the BUSINESS spends                 (008_expenses.sql)
-- A payment is always a customer payment. Nothing here derives a payment
-- recipient/payee from a phone number or any other person identifier.
--
-- The ledger is append-only and written ONLY by the SECURITY DEFINER
-- functions below, all of which take every amount, customer and number from
-- the database rows themselves — never from caller-supplied totals — and
-- take the acting user from auth.uid().
--
--   Outstanding for a customer = sum(debit) - sum(credit) = latest running_balance
-- ============================================================================

-- Lets payments reference (bill, customer) together, so a payment can never
-- name a different customer than the bill it settles.
alter table bills add constraint bills_id_customer_unique unique (id, customer_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique,
  customer_id uuid not null references customers (id),
  bill_id uuid,
  payment_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  amount numeric(14, 2) not null check (amount > 0),
  payment_mode text not null check (payment_mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'other')),
  reference_number text,
  -- Optional client-supplied key making a retried submission idempotent.
  idempotency_key text unique,
  notes text,
  recorded_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now(),
  constraint payments_bill_customer_fk
    foreign key (bill_id, customer_id) references bills (id, customer_id)
);
create index if not exists idx_payments_customer on payments (customer_id);
create index if not exists idx_payments_bill on payments (bill_id);

create table if not exists customer_ledger (
  id uuid primary key default gen_random_uuid(),
  -- Strictly increasing under the per-customer lock; the ordering key for
  -- running_balance (created_at is the transaction start time and cannot be
  -- trusted to follow lock order).
  entry_seq bigint generated always as identity,
  customer_id uuid not null references customers (id),
  transaction_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  transaction_type text not null check (transaction_type in ('bill', 'payment', 'adjustment', 'opening_balance')),
  reference_type text check (reference_type in ('bill', 'payment')),
  reference_id uuid,
  description text,
  debit numeric(14, 2) not null default 0,   -- increases what the customer owes
  credit numeric(14, 2) not null default 0,  -- reduces what the customer owes
  running_balance numeric(14, 2) not null,
  created_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now(),
  constraint ledger_one_side check (debit >= 0 and credit >= 0 and ((debit > 0) <> (credit > 0)))
);
create index if not exists idx_ledger_customer on customer_ledger (customer_id, entry_seq);
-- A given bill can be debited once, a payment credited once, a bill
-- cancelled once — never double-posted.
create unique index if not exists uq_ledger_reference
  on customer_ledger (transaction_type, reference_id) where reference_id is not null;

-- Internal primitive: appends a ledger row under a per-customer lock and
-- returns the new running balance. NOT callable by clients (EXECUTE revoked
-- below); only the functions in this file call it.
create or replace function append_ledger_entry(
  p_customer_id uuid,
  p_transaction_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_description text,
  p_debit numeric,
  p_credit numeric,
  p_transaction_date date default null
) returns numeric
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_last_balance numeric;
  v_new_balance numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 0));

  select running_balance into v_last_balance
  from customer_ledger
  where customer_id = p_customer_id
  order by entry_seq desc
  limit 1;

  v_new_balance := coalesce(v_last_balance, 0) + p_debit - p_credit;

  insert into customer_ledger (
    customer_id, transaction_date, transaction_type, reference_type, reference_id,
    description, debit, credit, running_balance, created_by
  ) values (
    p_customer_id, coalesce(p_transaction_date, (now() at time zone 'Asia/Kolkata')::date),
    p_transaction_type, p_reference_type, p_reference_id,
    p_description, p_debit, p_credit, v_new_balance, auth.uid()
  );

  return v_new_balance;
end;
$$;

-- Debits the customer for a bill. Amount, customer and number come from the
-- bill row. Idempotent by construction: a second call fails (the bill is
-- already posted, and the unique ledger reference index backs that up).
create or replace function post_bill_to_ledger(p_bill_id uuid)
returns numeric
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_bill bills;
  v_balance numeric;
begin
  if not is_active_staff() then
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

-- Records a payment RECEIVED FROM A CUSTOMER, atomically: payment row,
-- bill.amount_received (which re-derives payment_status) and the ledger
-- credit succeed or fail together.
--   * With a bill: the customer is taken from the bill; the bill must be
--     active and already posted to the ledger; the amount may not exceed
--     what is still due on it.
--   * Without a bill (an on-account payment): p_customer_id is required.
-- The payment number is generated here from the business's configured
-- prefix, and the recording user is auth.uid().
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
  if not is_active_staff() then
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

-- Admin-only. Cancels an active bill. A bill that already has payments
-- cannot be cancelled here (nothing reverses a payment yet). If it was
-- posted, an equal ledger credit reverses the debit.
create or replace function cancel_bill(p_bill_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_bill bills;
begin
  if not current_role_is('admin') then
    raise exception 'Only an admin may cancel a bill';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to cancel a bill';
  end if;

  select * into v_bill from bills where id = p_bill_id for update;
  if not found then
    raise exception 'Bill % not found', p_bill_id;
  end if;
  if v_bill.status <> 'active' then
    raise exception 'Bill % is already %', v_bill.bill_number, v_bill.status;
  end if;
  if v_bill.amount_received > 0 then
    raise exception 'Bill % has payments recorded against it and cannot be cancelled', v_bill.bill_number;
  end if;

  update bills
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancellation_reason = btrim(p_reason)
   where id = v_bill.id;

  if v_bill.ledger_posted_at is not null then
    perform append_ledger_entry(
      v_bill.customer_id, 'adjustment', 'bill', v_bill.id,
      'Cancelled bill ' || upper(v_bill.bill_type) || ' ' || v_bill.bill_number || ': ' || p_reason,
      0, v_bill.grand_total
    );
  end if;
end;
$$;

-- Admin-only. Opening balances and manual corrections, with a mandatory
-- description. Exactly one of debit / credit must be positive.
create or replace function record_ledger_adjustment(
  p_customer_id uuid,
  p_transaction_type text,
  p_debit numeric,
  p_credit numeric,
  p_description text
) returns numeric
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not current_role_is('admin') then
    raise exception 'Only an admin may post ledger adjustments';
  end if;
  if p_transaction_type not in ('opening_balance', 'adjustment') then
    raise exception 'Adjustment type must be opening_balance or adjustment';
  end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'A description is required';
  end if;
  return append_ledger_entry(
    p_customer_id, p_transaction_type, null, null, p_description,
    coalesce(p_debit, 0), coalesce(p_credit, 0)
  );
end;
$$;

-- Function privileges: nothing is executable by anon/public; only the four
-- entry points below are executable by signed-in users, and each enforces
-- its own role check. append_ledger_entry is internal only.
revoke execute on function append_ledger_entry(uuid, text, text, uuid, text, numeric, numeric, date) from public, anon, authenticated;
revoke execute on function post_bill_to_ledger(uuid) from public, anon;
revoke execute on function record_payment(uuid, uuid, numeric, text, text, text, date, text) from public, anon;
revoke execute on function cancel_bill(uuid, text) from public, anon;
revoke execute on function record_ledger_adjustment(uuid, text, numeric, numeric, text) from public, anon;
grant execute on function post_bill_to_ledger(uuid) to authenticated;
grant execute on function record_payment(uuid, uuid, numeric, text, text, text, date, text) to authenticated;
grant execute on function cancel_bill(uuid, text) to authenticated;
grant execute on function record_ledger_adjustment(uuid, text, numeric, numeric, text) to authenticated;
