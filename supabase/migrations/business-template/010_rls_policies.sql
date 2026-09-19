-- ============================================================================
-- Row Level Security AND table privileges. Together these — not the sidebar —
-- are the real enforcement of role restrictions (Rule #27): Staff cannot
-- read/write the Customer Ledger or Expenses no matter what URL or API call
-- they make.
--
-- Two layers, both required:
--   1. GRANTs decide which COLUMNS/OPERATIONS a signed-in user may touch at
--      all. Supabase grants ALL on new tables to anon/authenticated by
--      default, so this file first revokes that and re-grants the minimum.
--      Derived/financial columns (bill totals, amount_received, ledger
--      fields, stock quantity) are simply not granted for writing.
--   2. RLS policies decide which ROWS each role may read/write.
-- 011_measurement_sheets.sql applies the same two layers to its own tables.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Privileges: start from nothing.
-- --------------------------------------------------------------------------
-- Nobody but the migration owner may create objects in `public`: SECURITY
-- DEFINER functions resolve names through search_path (pinned to
-- pg_catalog, public, pg_temp), so an object planted in `public` by a
-- signed-in user must be impossible. Verify after deployment:
--   select has_schema_privilege('authenticated', 'public', 'create');  -- false
revoke create on schema public from public, anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, public;

-- Reference data / masters
grant select, insert, update, delete on staff_profiles to authenticated;
grant select, insert, update on units to authenticated;
grant select, insert, update on materials to authenticated;
grant select, insert, update, delete on customers to authenticated;

-- Stock: rows are created/edited by staff, but quantity_on_hand and
-- stock_movements are written only by apply_stock_movement().
grant select on stock_items to authenticated;
grant insert (material_id, batch_code, location, unit) on stock_items to authenticated;
grant update (batch_code, location) on stock_items to authenticated;
grant select on stock_movements to authenticated;
grant select on stock_balances to authenticated;
grant select on document_sequences to authenticated;

-- Quotations (provisional module)
grant select, insert, update, delete on quotations, quotation_items to authenticated;

-- Bills: derived totals, amount_received, payment_status, status and
-- ledger_posted_at are NOT writable by clients.
grant select on bills to authenticated;
grant insert (
  bill_type, bill_number, bill_number_source, customer_id, quotation_id, bill_date,
  party_name, party_address, party_gstin, eway_bill_number, vehicle_number, vehicle_id, trip_id,
  cgst_percent, sgst_percent, igst_percent, discount_amount, other_charges, notes, extra_fields
) on bills to authenticated;
grant update (
  bill_type, bill_number, bill_number_source, customer_id, quotation_id, bill_date,
  party_name, party_address, party_gstin, eway_bill_number, vehicle_number, vehicle_id, trip_id,
  cgst_percent, sgst_percent, igst_percent, discount_amount, other_charges, notes, extra_fields
) on bills to authenticated;
grant delete on bills to authenticated;      -- row-restricted by policy below
grant select, insert, update, delete on bill_items to authenticated;

-- Money movement is read-only from the client; writes go through
-- record_payment() / post_bill_to_ledger() / cancel_bill() /
-- record_ledger_adjustment().
grant select on payments to authenticated;
grant select on customer_ledger to authenticated;

grant select, insert, update, delete on drivers, vehicles, trips to authenticated;
grant select, insert, update, delete on expenses to authenticated;
grant select on settings to authenticated;
grant update (value) on settings to authenticated;
grant select on audit_logs to authenticated;

-- --------------------------------------------------------------------------
-- 2. Row Level Security
-- --------------------------------------------------------------------------
alter table staff_profiles enable row level security;
alter table materials enable row level security;
alter table units enable row level security;
alter table customers enable row level security;
alter table stock_items enable row level security;
alter table stock_movements enable row level security;
alter table document_sequences enable row level security;
alter table quotations enable row level security;
alter table quotation_items enable row level security;
alter table bills enable row level security;
alter table bill_items enable row level security;
alter table payments enable row level security;
alter table customer_ledger enable row level security;
alter table drivers enable row level security;
alter table vehicles enable row level security;
alter table trips enable row level security;
alter table expenses enable row level security;
alter table settings enable row level security;
alter table audit_logs enable row level security;

-- staff_profiles: everyone active can read the roster (needed for name
-- lookups); only admin manages it. (The helper functions are SECURITY
-- DEFINER precisely so these policies do not recurse — see 001.)
create policy "active staff can read profiles" on staff_profiles for select
  to authenticated using (is_active_staff());
create policy "admin manages staff profiles" on staff_profiles for all
  to authenticated using (current_role_is('admin')) with check (current_role_is('admin'));
-- A user must be able to read their OWN row before is_active_staff() can be
-- true for them only if the function is definer-rights — it is, so the
-- policy above is sufficient.

-- Reference data: any active staff can read; only admin writes.
create policy "staff read units" on units for select to authenticated using (is_active_staff());
create policy "admin inserts units" on units for insert to authenticated with check (current_role_is('admin'));
create policy "admin updates units" on units for update to authenticated
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "staff read materials" on materials for select to authenticated using (is_active_staff());
create policy "admin writes materials" on materials for insert to authenticated with check (current_role_is('admin'));
create policy "admin updates materials" on materials for update to authenticated
  using (current_role_is('admin')) with check (current_role_is('admin'));

-- Customers, Quotations, Vehicles, Drivers, Trips: both Admin and Staff have
-- full operational access.
create policy "staff full access customers" on customers for all
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "staff full access quotations" on quotations for all
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "staff full access quotation items" on quotation_items for all
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "staff full access drivers" on drivers for all
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "staff full access vehicles" on vehicles for all
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "staff full access trips" on trips for all
  to authenticated using (is_active_staff()) with check (is_active_staff());

-- Stock: staff may read, and create/relabel stock items (column grants
-- above). Quantities move only through apply_stock_movement(); there is
-- deliberately no INSERT policy on stock_movements.
create policy "staff read stock" on stock_items for select to authenticated using (is_active_staff());
create policy "staff create stock items" on stock_items for insert to authenticated with check (is_active_staff());
create policy "staff relabel stock items" on stock_items for update
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "staff read stock movements" on stock_movements for select
  to authenticated using (is_active_staff());

create policy "staff read document sequences" on document_sequences for select
  to authenticated using (is_active_staff());

-- Bills: staff may create and edit bills (within the column grants above —
-- they cannot set totals, amount_received, payment_status or status).
-- Only an admin may delete, and only a bill that was never posted to the
-- ledger. Line items follow the same rule implicitly: any change that would
-- alter a posted bill's total is rejected by bills_before_write().
create policy "staff read bills" on bills for select to authenticated using (is_active_staff());
create policy "staff create bills" on bills for insert to authenticated with check (is_active_staff());
create policy "staff edit bills" on bills for update
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "admin deletes unposted active bills" on bills for delete
  to authenticated using (current_role_is('admin') and ledger_posted_at is null and status = 'active');
create policy "staff full access bill items" on bill_items for all
  to authenticated using (is_active_staff()) with check (is_active_staff());

-- Payments: NO insert policy or privilege — every payment is created by
-- record_payment(), which keeps payment + bill + ledger atomic. Staff may
-- read payment history (shown against a bill); that is not Customer Ledger
-- visibility, which stays Admin-only below.
create policy "staff read payments" on payments for select
  to authenticated using (is_active_staff());

-- Customer Ledger: ADMIN ONLY (Rule #27 — hard requirement). No write
-- privilege exists for any client role.
create policy "admin only reads ledger" on customer_ledger for select
  to authenticated using (current_role_is('admin'));

-- Expenses: ADMIN ONLY (Rule #22/#27 — hard requirement).
create policy "admin only expenses" on expenses for all
  to authenticated using (current_role_is('admin')) with check (current_role_is('admin'));

-- Settings: any active staff can read (numbering prefixes etc.); only admin
-- can change the value (rows are seeded; keys cannot be added/renamed).
create policy "staff read settings" on settings for select to authenticated using (is_active_staff());
create policy "admin writes settings" on settings for update
  to authenticated using (current_role_is('admin')) with check (current_role_is('admin'));

-- Audit logs: admin-only read. Rows are written by audit_row_change()
-- (012), never by a client.
create policy "admin reads audit logs" on audit_logs for select
  to authenticated using (current_role_is('admin'));
