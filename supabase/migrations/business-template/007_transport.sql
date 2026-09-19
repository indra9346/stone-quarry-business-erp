-- ============================================================================
-- Vehicles, Drivers, Trips/Loads (spec #19-21).
-- ============================================================================

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  driver_name text not null,
  phone text,
  license_number text,
  license_expiry date,
  address text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_drivers_updated_at before update on drivers
  for each row execute function set_updated_at();

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null unique,
  vehicle_type text,
  make_model text,
  default_driver_id uuid references drivers (id),
  capacity text,
  status text not null default 'available' check (status in ('available', 'on_trip', 'maintenance', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_vehicles_updated_at before update on vehicles
  for each row execute function set_updated_at();

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  trip_number text not null unique,
  vehicle_id uuid not null references vehicles (id),
  driver_id uuid references drivers (id),
  customer_id uuid references customers (id),
  bill_id uuid references bills (id),
  material_id uuid references materials (id),
  quantity numeric(14, 3),
  unit text references units (code),
  pickup_location text,
  destination text,
  trip_date date not null default current_date,
  departure_time timestamptz,
  expected_delivery timestamptz,
  delivery_time timestamptz,
  status text not null default 'planned' check (
    status in ('planned', 'loaded', 'in_transit', 'delivered', 'cancelled')
  ),
  notes text,
  created_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_trips_updated_at before update on trips
  for each row execute function set_updated_at();
create index if not exists idx_trips_vehicle on trips (vehicle_id);
create index if not exists idx_trips_driver on trips (driver_id);
create index if not exists idx_trips_status on trips (status);
create trigger trg_trips_stamp_created_by before insert on trips
  for each row execute function stamp_created_by();

-- Real foreign keys for the vehicle/trip references on bills (declared as
-- plain uuids in 005_billing.sql, before these tables existed).
alter table bills add constraint bills_vehicle_fk foreign key (vehicle_id) references vehicles (id);
alter table bills add constraint bills_trip_fk foreign key (trip_id) references trips (id);
create index if not exists idx_bills_vehicle on bills (vehicle_id);
create index if not exists idx_bills_trip on bills (trip_id);
