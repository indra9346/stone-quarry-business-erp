-- Anonymous (no login). Every line should say "permission denied". Nothing is written.
do $$
declare
  out text := '';
  n int; t text;
begin
  execute 'set local role anon';
  foreach t in array array['customers', 'bills', 'customer_ledger', 'expenses', 'audit_logs', 'staff_profiles', 'payments'] loop
    begin
      execute format('select count(*) from %I', t) into n;
      out := out || format(E'%s: readable (BAD)\n', t);
    exception when others then out := out || format(E'%s: %s\n', t, sqlerrm); end;
  end loop;
  raise exception E'\nANON RESULTS:\n%', out;
end $$;
