-- ============================================================================
-- BUSINESS-TEMPLATE PROJECT — applied identically to EACH business's own
-- isolated Supabase project (KMG's project, Murudeshwara's project, and any
-- future quarry's project). Never applied to the CENTRAL project.
--
-- This file: extensions, roles, staff profiles, customers, product/material
-- master, configurable units.
-- ============================================================================

create extension if not exists "pgcrypto";

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

-- Convenience predicate functions used throughout RLS policies.
create or replace function current_role_is(required text)
returns boolean language sql stable as $$
  select exists (
    select 1 from staff_profiles sp
    where sp.user_id = auth.uid() and sp.status = 'active'
      and (sp.role = required or sp.role = 'admin')
  );
$$;

create or replace function is_active_staff()
returns boolean language sql stable as $$
  select exists (
    select 1 from staff_profiles sp where sp.user_id = auth.uid() and sp.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- units — configurable measurement units (Rule #15). Do not hardcode a
-- single unit; a material declares which unit(s) it is measured in.
-- ---------------------------------------------------------------------------
create table if not exists units (
  code text primary key,          -- 'piece' | 'sqft' | 'cuft' | 'ton' | 'kg' | 'load' | 'meter' | 'sqm' | 'other'
  label text not null,
  measurement_kind text not null check (measurement_kind in ('count', 'area', 'volume', 'weight', 'other'))
);
insert into units (code, label, measurement_kind) values
  ('piece', 'Piece', 'count'),
  ('sqft', 'Sq. Ft.', 'area'),
  ('cuft', 'Cu. Ft.', 'volume'),
  ('ton', 'Ton', 'weight'),
  ('kg', 'Kilogram', 'weight'),
  ('load', 'Load', 'count'),
  ('meter', 'Meter', 'other'),
  ('sqm', 'Sq. Meter', 'area')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- materials — the "product" master (stone types: blocks, cutting stone,
-- raw material, temple stone, etc). Dimension-based billing (spec #16) is
-- supported via `is_dimension_based`: when true, quantity is computed from
-- length/breadth/height at the line-item level rather than entered directly.
-- ---------------------------------------------------------------------------
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('block', 'cutting_stone', 'raw_material', 'finished', 'other')),
  hsn_code text,
  default_unit text not null references units (code),
  is_dimension_based boolean not null default false,
  -- for dimension-based materials: 'area' (L*B) or 'volume' (L*B*H); null otherwise
  dimension_calculation text check (dimension_calculation in ('area', 'volume')),
  default_rate numeric(14, 2),
  low_stock_threshold numeric(14, 3),
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
  -- Payment routing note (see BUSINESS_RULES.md "payments/mobile number"):
  -- a customer's preferred payment mobile/UPI handle is informational only.
  -- The RECEIVING account is always this business's own configured UPI/
  -- bank details in `settings`, never inferred from a customer record.
  preferred_payment_mobile text,
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
