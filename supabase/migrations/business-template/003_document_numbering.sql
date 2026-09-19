-- ============================================================================
-- Safe, concurrency-proof GENERATED document numbering (Rule #17/#51/#77).
-- Never generate numbers as `lastNumber + 1` in the browser — this uses a
-- row-locked counter per (document_type, year) inside the database.
--
-- This is only for numbers the system generates. Normal Bills may instead
-- carry an existing physical/manual number typed in by the user; that path
-- never touches this function (see bills.bill_number_source, 005_billing.sql).
-- Numbering formats for quotations and EV bills are NOT confirmed by the
-- business; callers supply the prefix and nothing here decides it.
-- ============================================================================

create table if not exists document_sequences (
  document_type text not null
    check (document_type in ('quotation', 'normal_bill', 'ev_bill', 'payment', 'trip', 'expense')),
  year int not null,
  prefix text not null,
  last_number int not null default 0,
  primary key (document_type, year)
);

-- Returns the next formatted document number, e.g. 'KMG-QT-2026-000001',
-- atomically incrementing the per-year counter. The year defaults to the
-- current year in the business timezone (Asia/Kolkata), not the server's.
--
-- SECURITY DEFINER is required: document_sequences only grants staff a
-- SELECT policy — deliberately, so no one can hand-edit a counter row.
-- The authorization check RLS would otherwise have provided is explicit.
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
  if not is_active_staff() then
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

revoke execute on function next_document_number(text, text, int, int) from public, anon;
grant execute on function next_document_number(text, text, int, int) to authenticated;
