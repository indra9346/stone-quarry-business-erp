import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { BusinessCode, UserRole } from '@/types/business'
import { BUSINESS_REGISTRY } from '@/types/business'

export interface BusinessSessionState {
  code: BusinessCode
  session: Session | null
  role: UserRole | null
  loading: boolean
  configured: boolean
}

export interface BusinessContextValue extends BusinessSessionState {
  profile: (typeof BUSINESS_REGISTRY)[BusinessCode]
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const BusinessContext = createContext<BusinessContextValue | null>(null)

export function useBusinessContext() {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusinessContext must be used within a BusinessProvider')
  return ctx
}
