-- Read-only. One result table; compare each row with the "expect" text.
select 'tables in public (expect 21)' as check_name, count(*)::text as value
from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'
union all
select 'tables WITHOUT row level security (expect 0)', count(*)::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
select 'authenticated can CREATE in schema public (expect false)',
       has_schema_privilege('authenticated', 'public', 'create')::text
union all
select 'functions anon can execute (expect 0)', count(*)::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
  and has_function_privilege('anon', p.oid, 'execute')
union all
select 'functions authenticated can execute (expect 8 names below)',
       string_agg(p.proname, ', ' order by p.proname)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
  and has_function_privilege('authenticated', p.oid, 'execute')
union all
select 'bills unique constraint (expect UNIQUE (bill_type, bill_number))',
       pg_get_constraintdef(oid)
from pg_constraint where conrelid = 'public.bills'::regclass and contype = 'u' and conname = 'bills_number_unique_per_type';
