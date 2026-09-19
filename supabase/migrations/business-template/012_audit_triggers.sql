-- ============================================================================
-- Attach the row-change audit trigger (009_settings_audit.sql) to every
-- table whose changes matter: money, documents, stock, people, and the
-- security-sensitive configuration. customer_ledger and stock_movements are
-- append-only histories in their own right and are audited on insert too.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'staff_profiles', 'units', 'materials', 'customers',
    'stock_items', 'stock_movements',
    'quotations', 'quotation_items',
    'bills', 'bill_items', 'payments', 'customer_ledger',
    'drivers', 'vehicles', 'trips',
    'expenses', 'settings',
    'measurement_sheets', 'measurement_sheet_rows'
  ]
  loop
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on %1$I
         for each row execute function audit_row_change()', t);
  end loop;
end
$$;
