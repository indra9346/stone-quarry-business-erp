-- ============================================================================
-- BUSINESS-TEMPLATE PROJECT — applied identically to EACH business's own
-- isolated Supabase project (KMG's project, Murudeshwara's project, and any
-- future quarry's project). Never applied to the CENTRAL project.
--
-- This file: extensions, roles, staff profiles, customers, product/material
-- master, configurable units.
-- ============================================================================

-- gen_random_uuid() is built into PostgreSQL 13+, so no extension is needed.

-- ---------------------------------------------------------------------------
-- updated_at helper, reused by every table below.
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- staff_profiles — role for THIS business only (Rule #12). A person who
-- also works at another business has a completely separate row in that
-- business's own project; there is no cross-project foreign key.
-- ---------------------------------------------------------------------------
create table if not exists staff_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null check (role in ('admin', 'staff')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_staff_profiles_updated_at before update on staff_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Convenience predicate functions used throughout RLS policies.
--
-- SECURITY DEFINER + fixed search_path is REQUIRED here, not optional.
-- staff_profiles' own RLS policies (below) call these functions to decide
-- who may read/write a row. If these functions were left as regular
-- (SECURITY INVOKER) functions, evaluating them AS PART OF a staff_profiles
-- policy would run their inner `select ... from staff_profiles` under that
-- same policy again -> infinite recursion / "stack depth limit exceeded" on
-- the very first login. Marking them SECURITY DEFINER makes the inner query
-- run as the function owner (the migration role), which is exempt from RLS
-- on tables it owns, breaking the loop. `search_path` is pinned so a
-- SECURITY DEFINER function can't be tricked by a session-level search_path
-- into resolving `staff_profiles` to an attacker-created object.
-- ---------------------------------------------------------------------------
create or replace function current_role_is(required text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from staff_profiles sp
    where sp.user_id = auth.uid() and sp.status = 'active'
      and (sp.role = required or sp.role = 'admin')
  );
$$;

create or replace function is_active_staff()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from staff_profiles sp where sp.user_id = auth.uid() and sp.status = 'active'
  );
$$;

revoke execute on function current_role_is(text) from public, anon;
revoke execute on function is_active_staff() from public, anon;
grant execute on function current_role_is(text) to authenticated;
grant execute on function is_active_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- units — configurable measurement units (Rule #15). Deliberately EMPTY:
-- the business has not confirmed which units it uses (the source documents
-- show a quantity with no unit, and a "PCS" column whose meaning is
-- unconfirmed), so no unit is invented here. An admin defines the units the
-- business actually uses. Nothing in the schema requires a unit on a
-- document line (bill_items.unit is nullable).
-- ---------------------------------------------------------------------------
create table if not exists units (
  code text primary key,
  label text not null,
  measurement_kind text not null default 'other'
    check (measurement_kind in ('count', 'area', 'volume', 'weight', 'other'))
);

-- ---------------------------------------------------------------------------
-- materials — the "product" master (stone types: blocks, cutting stone,
-- raw material, temple stone, etc). No dimension->quantity formula is
-- encoded anywhere: the business has not confirmed one, so quantities are
-- always entered/preserved as written on the source document.
-- ---------------------------------------------------------------------------
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('block', 'cutting_stone', 'raw_material', 'finished', 'other')),
  hsn_code text,
  default_unit text references units (code),
  default_rate numeric(14, 2) check (default_rate is null or default_rate >= 0),
  low_stock_threshold numeric(14, 3) check (low_stock_threshold is null or low_stock_threshold >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_materials_updated_at before update on materials
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text unique,
  customer_name text not null,
  company_name text,
  phone text,
  alternate_phone text,
  email text,
  billing_address text,
  shipping_address text,
  city text,
  state text,
  pincode text,
  gstin text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_customers_updated_at before update on customers
  for each row execute function set_updated_at();
create index if not exists idx_customers_name on customers using gin (to_tsvector('simple', customer_name));
create index if not exists idx_customers_phone on customers (phone);

-- ---------------------------------------------------------------------------
-- stamp_created_by() — forces created_by to the calling user on INSERT so a
-- client can never record a row as created by someone else. Attached (in the
-- table's own migration) to every table that has a created_by column.
-- ---------------------------------------------------------------------------
create or replace function stamp_created_by()
returns trigger language plpgsql as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger trg_customers_stamp_created_by before insert on customers
  for each row execute function stamp_created_by();
