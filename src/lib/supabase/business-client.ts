import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { BusinessCode } from '@/types/business'
import { getBusinessSupabaseConfig } from './env'

/**
 * Per-business Supabase client cache.
 *
 * CRITICAL ISOLATION RULE (ARCHITECTURE.md #6, #33, #34):
 *  - A client for a business is created LAZILY, only the first time that
 *    business is actually entered, never for every business up front.
 *  - Each business has its OWN Supabase project (own URL + anon key), so
 *    there is no shared connection, shared auth session, or shared
 *    `business_id` filter to forget. Cross-tenant leakage would require an
 *    entirely different project's credentials, not a missed WHERE clause.
 *  - Only the anon key ever reaches the browser. RLS in each project's
 *    database is the real enforcement boundary — see
 *    supabase/migrations/business-template/002_rls_policies.sql.
 *  - Switching business does NOT reuse another business's cached client or
 *    session; the caller (BusinessAuthProvider) must sign out of the
 *    previous business's client before/when switching (Rule #14).
 */
const clients = new Map<BusinessCode, SupabaseClient>()

export function getBusinessClient(code: BusinessCode): SupabaseClient | null {
  const existing = clients.get(code)
  if (existing) return existing

  const config = getBusinessSupabaseConfig(code)
  if (!config) return null

  const client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Isolated storage key per business so two business sessions can
      // never collide or bleed into each other in the same browser.
      storageKey: `sb-${code}-auth`,
    },
  })
  clients.set(code, client)
  return client
}

/** Drop a cached client (e.g. on "Logout Completely" for that business). */
export function clearBusinessClient(code: BusinessCode) {
  clients.delete(code)
}

export function isBusinessConfigured(code: BusinessCode): boolean {
  return getBusinessSupabaseConfig(code) !== null
}
