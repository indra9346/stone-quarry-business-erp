-- ============================================================================
-- Settings (business-specific configuration, Rule #16) + Audit Logs
-- (Rule #40, protected from normal staff modification).
-- ============================================================================

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references staff_profiles (user_id),
  updated_at timestamptz not null default now()
);

-- Seed sensible defaults. `payment_identifiers` holds this business's OWN
-- receiving UPI/bank identity — the account money actually lands in for
-- THIS business. It is never derived from a customer's phone number; a
-- customer's `preferred_payment_mobile` (see 001_core_schema.sql) is
-- informational only. See BUSINESS_RULES.md "Payment routing".
insert into settings (key, value) values
  ('business_profile', '{"name": "", "address": "", "phone": "", "email": "", "gstin": ""}'),
  ('document_prefixes', '{"quotation": "QT", "normal_bill": "INV", "ev_bill": "EV", "payment": "PAY", "trip": "TRP", "expense": "EXP"}'),
  ('tax_defaults', '{"cgst_percent": 2.5, "sgst_percent": 2.5, "igst_percent": 0}'),
  ('payment_identifiers', '{"upi_vpa": "", "upi_mobile": "", "bank_account_name": "", "bank_account_number": "", "bank_ifsc": ""}'),
  ('low_stock_alerting', '{"enabled": true}')
on conflict (key) do nothing;

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references staff_profiles (user_id),
  action text not null,               -- 'bill_created' | 'payment_recorded' | 'stock_adjusted' | ...
  module text not null,
  record_id uuid,
  previous_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_module on audit_logs (module, record_id);
create index if not exists idx_audit_logs_actor on audit_logs (actor_id);
