-- ============================================================================
-- CENTRAL project table privileges. Supabase grants ALL on new tables to
-- anon/authenticated by default; RLS (001) is the row filter, but privileges
-- are the first layer, so start from nothing and re-grant the minimum.
-- Writes to central_users and central_audit_logs come from the service role
-- (server-side/admin tooling) only — never from the browser.
-- ============================================================================

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant select on central_businesses, central_users, central_user_business_access, central_audit_logs to authenticated;
-- Super-admin management of the registry and grants (policy-restricted in 001).
grant insert, update, delete on central_businesses, central_user_business_access to authenticated;
