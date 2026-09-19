-- ============================================================================
-- Payments + Customer Ledger. The ledger is derived/append-only: rows are
-- written by record_payment()/create bill flow, never hand-edited, so the
-- running balance can always be trusted (Rule #12/#41).
-- ============================================================================

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique,
  customer_id uuid not null references customers (id),
  bill_id uuid references bills (id),
  payment_date date not null default current_date,
  amount numeric(14, 2) not null check (amount > 0),
  payment_mode text not null check (payment_mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'other')),
  reference_number text,
  -- The business's OWN receiving UPI/bank identity this payment landed in
  -- (from settings), recorded at time of payment so historical receipts
  -- remain accurate even if settings change later. See BUSINESS_RULES.md.
  received_via_identifier text,
  notes text,
  recorded_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_customer on payments (customer_id);
create index if not exists idx_payments_bill on payments (bill_id);

create table if not exists customer_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id),
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in ('bill', 'payment', 'adjustment', 'opening_balance')),
  reference_type text,                 -- 'bill' | 'payment' | 'adjustment'
  reference_id uuid,
  description text,
  debit numeric(14, 2) not null default 0,   -- bill amounts increase what customer owes
  credit numeric(14, 2) not null default 0,  -- payments/credits reduce it
  running_balance numeric(14, 2) not null,
  created_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now()
);
create index if not exists idx_ledger_customer on customer_ledger (customer_id, transaction_date);

-- Appends a ledger row and returns the new running balance. ALWAYS call this
-- instead of inserting into customer_ledger directly, so the balance is
-- computed under a row lock and can never race with a concurrent write.
--
-- SECURITY DEFINER is required: 010_rls_policies.sql intentionally grants
-- NO insert/update policy on customer_ledger to any role (Rule #41 — the
-- ledger must be tamper-proof from the API layer, writable only through
-- this function). Without SECURITY DEFINER, RLS would silently block this
-- INSERT for every caller, Admin included, and no bill or payment could
-- ever post to the ledger. The is_active_staff() check below replaces the
-- authorization RLS would otherwise have provided.
create or replace function append_ledger_entry(
  p_customer_id uuid,
  p_transaction_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_description text,
  p_debit numeric,
  p_credit numeric,
  p_created_by uuid
) returns numeric
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_last_balance numeric;
  v_new_balance numeric;
begin
  if not is_active_staff() then
    raise exception 'Not authorized to post ledger entries';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 0));

  select running_balance into v_last_balance
  from customer_ledger
  where customer_id = p_customer_id
  order by created_at desc, id desc
  limit 1;

  v_last_balance := coalesce(v_last_balance, 0);
  v_new_balance := v_last_balance + p_debit - p_credit;

  insert into customer_ledger (
    customer_id, transaction_type, reference_type, reference_id,
    description, debit, credit, running_balance, created_by
  ) values (
    p_customer_id, p_transaction_type, p_reference_type, p_reference_id,
    p_description, p_debit, p_credit, v_new_balance, p_created_by
  );

  return v_new_balance;
end;
$$;

-- Records a payment atomically: inserts the payment row, updates the bill's
-- amount_received (which re-triggers payment_status sync from 005), and
-- appends the ledger credit — all-or-nothing (Rule #13/#42).
--
-- SECURITY DEFINER + explicit auth check, same reasoning as
-- append_ledger_entry above. This is also now the ONLY way a payment row
-- can be created: 010_rls_policies.sql was corrected to remove the direct
-- "staff record payments" INSERT policy on `payments`, so a caller can no
-- longer insert a payment that skips updating the bill/ledger — every
-- payment is guaranteed to keep bills.amount_received and customer_ledger
-- consistent (this closes a real gap found during review: the original
-- policy let staff insert into `payments` directly, bypassing this
-- function entirely).
create or replace function record_payment(
  p_payment_number text,
  p_customer_id uuid,
  p_bill_id uuid,
  p_amount numeric,
  p_payment_mode text,
  p_reference_number text,
  p_received_via_identifier text,
  p_notes text,
  p_recorded_by uuid
) returns payments
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_payment payments;
begin
  if not is_active_staff() then
    raise exception 'Not authorized to record payments';
  end if;

  insert into payments (
    payment_number, customer_id, bill_id, amount, payment_mode,
    reference_number, received_via_identifier, notes, recorded_by
  ) values (
    p_payment_number, p_customer_id, p_bill_id, p_amount, p_payment_mode,
    p_reference_number, p_received_via_identifier, p_notes, p_recorded_by
  ) returning * into v_payment;

  if p_bill_id is not null then
    update bills set amount_received = amount_received + p_amount where id = p_bill_id;
  end if;

  perform append_ledger_entry(
    p_customer_id, 'payment', 'payment', v_payment.id,
    'Payment ' || p_payment_number, 0, p_amount, p_recorded_by
  );

  return v_payment;
end;
$$;

-- Posts a finalized bill to the ledger as a debit. Called once, right after
-- the bill (and its stock movements) are created.
create or replace function post_bill_to_ledger(
  p_bill_id uuid,
  p_customer_id uuid,
  p_bill_number text,
  p_grand_total numeric,
  p_created_by uuid
) returns numeric
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not is_active_staff() then
    raise exception 'Not authorized to post bills to the ledger';
  end if;

  return append_ledger_entry(
    p_customer_id, 'bill', 'bill', p_bill_id,
    'Bill ' || p_bill_number, p_grand_total, 0, p_created_by
  );
end;
$$;

revoke execute on function append_ledger_entry(uuid, text, text, uuid, text, numeric, numeric, uuid) from public;
revoke execute on function record_payment(text, uuid, uuid, numeric, text, text, text, text, uuid) from public;
revoke execute on function post_bill_to_ledger(uuid, uuid, text, numeric, uuid) from public;
grant execute on function append_ledger_entry(uuid, text, text, uuid, text, numeric, numeric, uuid) to authenticated;
grant execute on function record_payment(text, uuid, uuid, numeric, text, text, text, text, uuid) to authenticated;
grant execute on function post_bill_to_ledger(uuid, uuid, text, numeric, uuid) to authenticated;
