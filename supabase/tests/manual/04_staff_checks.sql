-- Staff restrictions. First create a second Auth user in the dashboard, then:
--   insert into public.staff_profiles (user_id, full_name, role)
--   values ('STAFF-EXACT-ID', 'Test Staff', 'staff');
-- Then replace <STAFF_UUID> below. Everything is rolled back (intentional error).
--
-- Expect: ledger/expense/audit rows visible = 0; customers visible >= 1;
--         every write line "rejected".
do $$
declare
  out text := '';
  c uuid; n int;
begin
  -- As the SQL Editor's owner role: plant rows that Staff must NOT be able to see.
  insert into customers (customer_name) values ('ZZ TEST (rolled back)') returning id into c;
  insert into customer_ledger (customer_id, transaction_type, debit, running_balance) values (c, 'opening_balance', 100, 100);
  insert into expenses (expense_number, category, amount) values ('TEST-EXP', 'fuel', 1);

  perform set_config('request.jwt.claim.sub', '<STAFF_UUID>', true);
  execute 'set local role authenticated';

  select count(*) into n from customer_ledger; out := out || format(E'ledger rows visible  : %s (expect 0)\n', n);
  select count(*) into n from expenses;        out := out || format(E'expense rows visible : %s (expect 0)\n', n);
  select count(*) into n from audit_logs;      out := out || format(E'audit rows visible   : %s (expect 0)\n', n);
  select count(*) into n from customers;       out := out || format(E'customers visible    : %s (expect >= 1)\n', n);
  select count(*) into n from payments;        out := out || format(E'payments readable    : %s rows (no error = allowed for Staff)\n', n);

  begin
    insert into expenses (expense_number, category, amount) values ('X', 'fuel', 1);
    out := out || E'insert expense      : ALLOWED (bad)\n';
  exception when others then out := out || format(E'insert expense      : rejected (%s)\n', left(sqlerrm, 50)); end;

  begin
    perform record_ledger_adjustment(c, 'adjustment', 1, null, 'x');
    out := out || E'ledger adjustment   : ALLOWED (bad)\n';
  exception when others then out := out || format(E'ledger adjustment   : rejected (%s)\n', left(sqlerrm, 50)); end;

  begin
    update bills set grand_total = 1;
    out := out || E'write bill total    : ALLOWED (bad)\n';
  exception when others then out := out || format(E'write bill total    : rejected (%s)\n', left(sqlerrm, 50)); end;

  raise exception E'\nSTAFF RESULTS (rolled back):\n%', out;
end $$;
