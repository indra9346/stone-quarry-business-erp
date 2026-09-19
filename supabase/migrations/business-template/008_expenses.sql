-- ============================================================================
-- Expenses — Admin-only module (Rule #22/#27: staff must NOT access this).
-- ============================================================================

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number text not null unique,
  expense_date date not null default current_date,
  expense_time time,
  category text not null check (
    category in ('fuel', 'labour', 'vehicle', 'factory', 'quarry', 'maintenance',
                 'electricity', 'transport', 'office', 'other')
  ),
  amount numeric(14, 2) not null check (amount > 0),
  description text,
  vendor_name text,
  payment_mode text check (payment_mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'other')),
  reference_number text,
  vehicle_id uuid references vehicles (id),
  trip_id uuid references trips (id),
  notes text,
  created_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_expenses_updated_at before update on expenses
  for each row execute function set_updated_at();
create index if not exists idx_expenses_date on expenses (expense_date);
create index if not exists idx_expenses_category on expenses (category);
