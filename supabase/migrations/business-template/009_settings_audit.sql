-- ============================================================================
-- Settings (business-specific configuration, Rule #16) + Audit Logs
-- (Rule #40, protected from modification by any client).
-- ============================================================================

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references staff_profiles (user_id),
  updated_at timestamptz not null default now()
);

-- Defaults. None of these encode an unconfirmed business rule:
--   * tax percentages are left NULL (an invoice's CGST/SGST/IGST are entered
--     per bill; a single sample invoice does not establish a default rate);
--   * there is no payment-account / payee configuration of any kind.
insert into settings (key, value) values
  ('business_profile', '{"name": "", "address": "", "phone": "", "email": "", "gstin": ""}'),
  ('document_prefixes', '{"quotation": "QT", "normal_bill": "INV", "ev_bill": "EV", "payment": "PAY", "trip": "TRP", "expense": "EXP"}'),
  ('tax_defaults', '{"cgst_percent": null, "sgst_percent": null, "igst_percent": null}'),
  ('low_stock_alerting', '{"enabled": true}')
on conflict (key) do nothing;

create or replace function stamp_updated_by()
returns trigger language plpgsql as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_settings_stamp_updated_by before insert or update on settings
  for each row execute function stamp_updated_by();

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,                      -- deliberately no FK: the log outlives any staff row
  action text not null,               -- 'INSERT' | 'UPDATE' | 'DELETE'
  module text not null,               -- table name
  record_id uuid,
  previous_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_module on audit_logs (module, record_id);
create index if not exists idx_audit_logs_actor on audit_logs (actor_id);
create index if not exists idx_audit_logs_created on audit_logs (created_at);

-- Generic row-change audit trigger, attached to the financially/operationally
-- important tables in 012_audit_triggers.sql. Audit rows are written by the
-- database itself (SECURITY DEFINER), so a client can neither skip nor forge
-- them; audit_logs has no INSERT/UPDATE/DELETE privilege for any client.
-- An UPDATE that changes nothing but updated_at is not logged. Rows contain
-- table data only — no credentials are stored anywhere in this schema.
create or replace function audit_row_change()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_id uuid;
begin
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return null;
  end if;

  -- id for most tables, user_id for staff_profiles, none for settings/etc.
  v_id := coalesce(v_row ->> 'id', v_row ->> 'user_id')::uuid;

  insert into audit_logs (actor_id, action, module, record_id, previous_values, new_values)
  values (auth.uid(), tg_op, tg_table_name, v_id, v_old, v_new);
  return null;
end;
$$;
revoke execute on function audit_row_change() from public, anon, authenticated;
