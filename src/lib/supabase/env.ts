import type { BusinessCode } from '@/types/business'

interface SupabaseProjectConfig {
  url: string
  anonKey: string
}

/**
 * Reads env vars for a given business's ISOLATED Supabase project.
 * Central rule (see ARCHITECTURE.md #6): a business's connection details are
 * only ever read when that specific business is entered — never eagerly for
 * every business at app startup.
 */
export function getBusinessSupabaseConfig(code: BusinessCode): SupabaseProjectConfig | null {
  const map: Record<BusinessCode, SupabaseProjectConfig> = {
    kmg: {
      url: import.meta.env.VITE_KMG_SUPABASE_URL ?? '',
      anonKey: import.meta.env.VITE_KMG_SUPABASE_ANON_KEY ?? '',
    },
    murudeshwara: {
      url: import.meta.env.VITE_MURUDESHWARA_SUPABASE_URL ?? '',
      anonKey: import.meta.env.VITE_MURUDESHWARA_SUPABASE_ANON_KEY ?? '',
    },
  }

  const config = map[code]
  if (!config.url || !config.anonKey) return null
  return config
}

export function getCentralSupabaseConfig(): SupabaseProjectConfig | null {
  const url = import.meta.env.VITE_CENTRAL_SUPABASE_URL ?? ''
  const anonKey = import.meta.env.VITE_CENTRAL_SUPABASE_ANON_KEY ?? ''
  if (!url || !anonKey) return null
  return { url, anonKey }
}
