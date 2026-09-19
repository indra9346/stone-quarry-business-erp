-- Admin flow. Replace <ADMIN_UUID> with your admin's id (keep the quotes).
-- EVERYTHING here is rolled back: the block ends with an intentional error, and
-- its results are shown in the red error message.
--
-- Expect: 1 subtotal=23400.00 cgst=585.00 sgst=585.00 igst=NULL grand=24570.00
--         2 all NULL = true      3 allowed      4-7 rejected
--         8 same payment = true  9 rejected     10 paid, balance_due=0.00
--         11 rejected            12 cancelled, balance_due=0.00
--         13 rejected            14 4 rows, balance=0.00
do $$
declare
  out text := '';
  c uuid; b uuid; b2 uuid;
  r record;
  p1 payments; p2 payments;
begin
  perform set_config('request.jwt.claim.sub', '<ADMIN_UUID>', true);
  execute 'set local role authenticated';

  insert into customers (customer_name) values ('ZZ TEST (rolled back)') returning id into c;
  insert into bills (bill_type, bill_number, bill_number_source, customer_id, cgst_percent, sgst_percent)
    values ('normal', 'TEST-1', 'manual', c, 2.5, 2.5) returning id into b;
  insert into bill_items (bill_id, description, hsn_code, quantity, rate, amount, sort_order)
    values (b, 'Temple stone', '6802', 390, 60, 23400, 1);
  insert into bill_items (bill_id, description, sort_order) values (b, 'Temple cutting', 2);

  select subtotal, cgst_amount, sgst_amount, igst_amount, grand_total into r from bills where id = b;
  out := out || format(E'1 totals      : subtotal=%s cgst=%s sgst=%s igst=%s grand=%s\n',
    r.subtotal, r.cgst_amount, r.sgst_amount, coalesce(r.igst_amount::text, 'NULL'), r.grand_total);

  select (quantity is null and unit is null and rate is null and amount is null) as all_null
    into r from bill_items where bill_id = b and description = 'Temple cutting';
  out := out || format(E'2 NULL line   : all NULL = %s\n', r.all_null::text);

  begin
    insert into bills (bill_type, bill_number, bill_number_source, customer_id) values ('ev', 'TEST-1', 'manual', c);
    out := out || E'3 EV same no. : allowed\n';
  exception when others then out := out || format(E'3 EV same no. : FAILED %s\n', sqlerrm); end;

  begin
    insert into bills (bill_type, bill_number, bill_number_source, customer_id) values ('normal', 'TEST-1', 'manual', c);
    out := out || E'4 dup normal  : ALLOWED (bad)\n';
  exception when others then out := out || format(E'4 dup normal  : rejected (%s)\n', left(sqlerrm, 50)); end;

  perform post_bill_to_ledger(b);

  begin
    perform post_bill_to_ledger(b);
    out := out || E'5 double post : ALLOWED (bad)\n';
  exception when others then out := out || format(E'5 double post : rejected (%s)\n', left(sqlerrm, 50)); end;

  begin
    update bills set discount_amount = 1 where id = b;
    out := out || E'6 edit posted : ALLOWED (bad)\n';
  exception when others then out := out || format(E'6 edit posted : rejected (%s)\n', left(sqlerrm, 50)); end;

  begin
    delete from bill_items where bill_id = b and description = 'Temple cutting';
    out := out || E'7 del line    : ALLOWED (bad)\n';
  exception when others then out := out || format(E'7 del line    : rejected (%s)\n', left(sqlerrm, 50)); end;

  select * into p1 from record_payment(null, b, 24570, 'cash', 'TEST', null, current_date, 'demo-key');
  select * into p2 from record_payment(null, b, 24570, 'cash', 'TEST', null, current_date, 'demo-key');
  out := out || format(E'8 payment     : %s ; retry with same key returns same payment = %s\n', p1.payment_number, (p1.id = p2.id)::text);

  begin
    perform record_payment(null, b, 1, 'cash', null, null, current_date, 'demo-key-2');
    out := out || E'9 overpay     : ALLOWED (bad)\n';
  exception when others then out := out || format(E'9 overpay     : rejected (%s)\n', left(sqlerrm, 50)); end;

  select payment_status, balance_due into r from bills where id = b;
  out := out || format(E'10 bill       : %s, balance_due=%s\n', r.payment_status, r.balance_due);

  begin
    delete from payments where id = p1.id;
    out := out || E'11 del payment: ALLOWED (bad)\n';
  exception when others then out := out || format(E'11 del payment: rejected (%s)\n', left(sqlerrm, 50)); end;

  insert into bills (bill_type, bill_number, bill_number_source, customer_id)
    values ('normal', 'TEST-2', 'manual', c) returning id into b2;
  insert into bill_items (bill_id, description, quantity, rate, amount) values (b2, 'TEST line', 1, 100, 100);
  perform post_bill_to_ledger(b2);
  perform cancel_bill(b2, 'demo');
  select status, balance_due into r from bills where id = b2;
  out := out || format(E'12 cancelled  : %s, balance_due=%s\n', r.status, r.balance_due);

  begin
    update bills set notes = 'x' where id = b2;
    out := out || E'13 edit cancelled: ALLOWED (bad)\n';
  exception when others then out := out || format(E'13 edit cancelled: rejected (%s)\n', left(sqlerrm, 50)); end;

  select count(*) as n, coalesce(sum(debit), 0) - coalesce(sum(credit), 0) as bal
    into r from customer_ledger where customer_id = c;
  out := out || format(E'14 ledger     : %s rows, balance=%s\n', r.n, r.bal);

  raise exception E'\nDEMO RESULTS (all rolled back):\n%', out;
end $$;
