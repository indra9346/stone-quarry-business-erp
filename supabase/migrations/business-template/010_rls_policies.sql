-- ============================================================================
-- Row Level Security. This — not the sidebar — is the real enforcement of
-- Staff restrictions (Rule #27): Staff cannot read/write Customer Ledger or
-- Expenses no matter what URL or API call they make.
-- ============================================================================

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
-- lookups); only admin manages it.
create policy "active staff can read profiles" on staff_profiles for select
  to authenticated using (is_active_staff());
create policy "admin manages staff profiles" on staff_profiles for all
  to authenticated using (current_role_is('admin')) with check (current_role_is('admin'));

-- Reference data: any active staff can read; only admin writes.
create policy "staff read units" on units for select to authenticated using (is_active_staff());
create policy "staff read materials" on materials for select to authenticated using (is_active_staff());
create policy "admin writes materials" on materials for insert to authenticated with check (current_role_is('admin'));
create policy "admin updates materials" on materials for update to authenticated using (current_role_is('admin'));

-- Customers, Quotations, Bills, Stock, Vehicles, Drivers, Trips: both
-- Admin and Staff have full operational access (spec Admin/Staff module
-- lists both include these).
create policy "staff full access customers" on customers for all
  to authenticated using (is_active_staff()) with check (is_active_staff());

create policy "staff read stock" on stock_items for select to authenticated using (is_active_staff());
create policy "staff write stock" on stock_items for all
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "staff read stock movements" on stock_movements for select
  to authenticated using (is_active_staff());
create policy "staff insert stock movements" on stock_movements for insert
  to authenticated with check (is_active_staff());

create policy "staff full access quotations" on quotations for all
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "staff full access quotation items" on quotation_items for all
  to authenticated using (is_active_staff()) with check (is_active_staff());

create policy "staff full access bills" on bills for all
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "staff full access bill items" on bill_items for all
  to authenticated using (is_active_staff()) with check (is_active_staff());

create policy "staff read document sequences" on document_sequences for select
  to authenticated using (is_active_staff());

create policy "staff full access drivers" on drivers for all
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "staff full access vehicles" on vehicles for all
  to authenticated using (is_active_staff()) with check (is_active_staff());
create policy "staff full access trips" on trips for all
  to authenticated using (is_active_staff()) with check (is_active_staff());

-- Payments: NO direct insert policy is granted here, on purpose (corrected
-- during review — an earlier draft granted staff a direct INSERT policy on
-- `payments`, which would have let application code create a payment row
-- without going through record_payment(), silently skipping the matching
-- bill.amount_received update and ledger entry). All payments MUST be
-- created via the SECURITY DEFINER record_payment() function
-- (006_payments_ledger.sql), which performs its own is_active_staff()
-- check and keeps payment + bill + ledger atomic. Staff can still read
-- payment history (needed to show "amount received" on a bill) — that is
-- not the same as Customer Ledger visibility, which stays Admin-only below.
create policy "staff read payments" on payments for select
  to authenticated using (is_active_staff());

-- Customer Ledger: ADMIN ONLY (Rule #27 — hard requirement).
create policy "admin only reads ledger" on customer_ledger for select
  to authenticated using (current_role_is('admin'));
-- Ledger rows are written exclusively through append_ledger_entry() /
-- record_payment() (SECURITY DEFINER-free; runs as the calling user), so no
-- direct insert/update policy is granted to any role — this keeps the
-- ledger tamper-proof from the API layer (Rule #41).

-- Expenses: ADMIN ONLY (Rule #22/#27 — hard requirement).
create policy "admin only expenses" on expenses for all
  to authenticated using (current_role_is('admin')) with check (current_role_is('admin'));

-- Settings: any active staff can read (needed for numbering prefixes,
-- tax defaults, etc. at document-creation time); only admin can change them.
create policy "staff read settings" on settings for select to authenticated using (is_active_staff());
create policy "admin writes settings" on settings for update
  to authenticated using (current_role_is('admin')) with check (current_role_is('admin'));

-- Audit logs: admin-only read; inserted by the application via the
-- authenticated user's own writes (insert policy checks the actor matches
-- the caller so no one can forge another user's audit trail).
create policy "admin reads audit logs" on audit_logs for select
  to authenticated using (current_role_is('admin'));
create policy "staff insert own audit rows" on audit_logs for insert
  to authenticated with check (actor_id = auth.uid());
