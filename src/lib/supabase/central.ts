import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getCentralSupabaseConfig } from './env'

let cachedClient: SupabaseClient | null = null

/**
 * The CENTRAL Supabase project. Holds ONLY:
 *   central_businesses, central_users, central_user_business_access,
 *   central_audit_logs
 * Never holds operational data (customers, bills, stock, ...) for any
 * business — see supabase/migrations/central/ and ARCHITECTURE.md #7.
 */
export function getCentralClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient
  const config = getCentralSupabaseConfig()
  if (!config) return null
  cachedClient = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return cachedClient
}
