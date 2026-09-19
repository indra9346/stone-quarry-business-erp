-- ============================================================================
-- CENTRAL PROJECT — business registry + cross-business access control ONLY.
-- This project must NEVER contain operational data (customers, bills,
-- stock, ledger, ...) for any business. See ARCHITECTURE.md #7.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- central_businesses — the portal registry shown on the Main Branch gateway.
-- ---------------------------------------------------------------------------
create table if not exists central_businesses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- 'kmg' | 'murudeshwara' | ...
  name text not null,
  legal_name text not null,
  tagline text,
  location text,
  logo_url text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  -- Non-secret reference only. The actual Supabase URL/anon key for a
  -- business's project live in env vars (see .env.example), never in a
  -- database row, so a compromised central DB cannot leak another
  -- project's connection details.
  supabase_project_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- central_users — mirrors auth.users for people who need cross-business
-- identity (e.g. a central/super admin). Ordinary single-business staff can
-- be created directly in that business's own Supabase project instead.
-- ---------------------------------------------------------------------------
create table if not exists central_users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- central_user_business_access — which central users may enter which
-- business, and the role they hold there (Rule #11/#12).
-- ---------------------------------------------------------------------------
create table if not exists central_user_business_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references central_users (id) on delete cascade,
  business_id uuid not null references central_businesses (id) on delete cascade,
  role text not null check (role in ('admin', 'staff')),
  granted_at timestamptz not null default now(),
  granted_by uuid references central_users (id),
  unique (user_id, business_id)
);

-- ---------------------------------------------------------------------------
-- central_audit_logs — central-level events only (business entered, access
-- granted/revoked, business activated/deactivated). Per-business operational
-- audit logs live inside that business's own project (Rule #37).
-- ---------------------------------------------------------------------------
create table if not exists central_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references central_users (id),
  action text not null,
  business_id uuid references central_businesses (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_central_access_user on central_user_business_access (user_id);
create index if not exists idx_central_access_business on central_user_business_access (business_id);
create index if not exists idx_central_audit_business on central_audit_logs (business_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table central_businesses enable row level security;
alter table central_users enable row level security;
alter table central_user_business_access enable row level security;
alter table central_audit_logs enable row level security;

-- Any authenticated central user may see the (non-sensitive) list of active
-- businesses, to render the gateway cards.
create policy "authenticated can read active businesses"
  on central_businesses for select
  to authenticated
  using (status = 'active');

create policy "users can read their own central profile"
  on central_users for select
  to authenticated
  using (id = auth.uid());

create policy "users can read their own business access"
  on central_user_business_access for select
  to authenticated
  using (user_id = auth.uid());

-- Only a super admin may manage the registry / access grants / view all
-- central audit logs. (Adjust to a dedicated `central_admins` claim/JWT if
-- you prefer not to query central_users on every write.)
create policy "super admin manages businesses"
  on central_businesses for all
  to authenticated
  using (exists (select 1 from central_users u where u.id = auth.uid() and u.is_super_admin))
  with check (exists (select 1 from central_users u where u.id = auth.uid() and u.is_super_admin));

create policy "super admin manages access grants"
  on central_user_business_access for all
  to authenticated
  using (exists (select 1 from central_users u where u.id = auth.uid() and u.is_super_admin))
  with check (exists (select 1 from central_users u where u.id = auth.uid() and u.is_super_admin));

create policy "super admin reads audit logs"
  on central_audit_logs for select
  to authenticated
  using (exists (select 1 from central_users u where u.id = auth.uid() and u.is_super_admin));

-- Seed the two initial businesses (safe, non-secret metadata only).
insert into central_businesses (code, name, legal_name, tagline, location, status)
values
  ('kmg', 'KMG Stones', 'KMG Enterprises', 'Stone • Quarry • Factory',
   'Chikkagollahalli Village, Kundana Hobali, Devanahalli Taluk, Bangalore Rural Dist.', 'active'),
  ('murudeshwara', 'Murudeshwara Stones', 'Murudeshwara Stones', 'Stone • Quarry • Factory', null, 'active')
on conflict (code) do nothing;
