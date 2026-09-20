import { createContext, useContext } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { BusinessCode, BusinessProfile } from '@/types/business'
import type { StaffRole } from '@/types/db'
import type { ModuleId, PermissionLevel, Permissions } from '@/lib/permissions'

/**
 * Where the visitor stands relative to ONE business portal:
 *  - unconfigured : no Supabase project is configured for this business yet
 *  - loading      : resolving the session / staff profile
 *  - signed_out   : no session
 *  - no_access    : signed in, but no ACTIVE staff profile in THIS business's
 *                   database (inactive account, or never granted access)
 *  - ready        : signed in with an active role
 */
export type AccessState = 'unconfigured' | 'loading' | 'signed_out' | 'no_access' | 'ready'

export interface BusinessContextValue {
  code: BusinessCode
  profile: BusinessProfile
  configured: boolean
  accessState: AccessState
  /** This business's own Supabase client. Never another business's. */
  client: SupabaseClient | null
  session: Session | null
  userId: string | null
  email: string | null
  fullName: string | null
  role: StaffRole | null
  isAdmin: boolean
  /** Per-person overrides set by an admin (null = role defaults). */
  permissions: Permissions | null
  /** Does this person have at least `need` access to a module? (Menu/route/button UX; the database enforces it.) */
  can: (module: ModuleId, need?: PermissionLevel) => boolean
  /** True while the user is completing a password-reset link. */
  recovery: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

export const BusinessContext = createContext<BusinessContextValue | null>(null)

export function useBusinessContext() {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusinessContext must be used within a BusinessProvider')
  return ctx
}
