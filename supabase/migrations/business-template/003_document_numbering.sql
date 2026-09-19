-- ============================================================================
-- Safe, concurrency-proof document numbering (Rule #17/#51/#77).
-- Never generate numbers as `lastNumber + 1` in the browser — this uses a
-- row-locked counter per (document_type, year) inside the database.
-- ============================================================================

create table if not exists document_sequences (
  document_type text not null,     -- 'quotation' | 'normal_bill' | 'ev_bill' | 'payment' | 'trip' | 'expense'
  year int not null,
  prefix text not null,
  last_number int not null default 0,
  primary key (document_type, year)
);

-- Returns the next formatted document number, e.g. 'KMG-QT-2026-000001',
-- atomically incrementing the per-year counter. Prefix is passed in from
-- settings (business-configurable, Rule #16), never hardcoded here.
create or replace function next_document_number(
  p_document_type text,
  p_prefix text,
  p_year int default extract(year from now())::int,
  p_padding int default 6
) returns text
language plpgsql as $$
declare
  v_next int;
begin
  insert into document_sequences (document_type, year, prefix, last_number)
  values (p_document_type, p_year, p_prefix, 1)
  on conflict (document_type, year)
  do update set last_number = document_sequences.last_number + 1
  returning last_number into v_next;

  return p_prefix || '-' || p_year || '-' || lpad(v_next::text, p_padding, '0');
end;
$$;
