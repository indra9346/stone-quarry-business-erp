import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { BusinessCode, UserRole } from '@/types/business'
import { BUSINESS_REGISTRY } from '@/types/business'
import { getBusinessClient, isBusinessConfigured } from '@/lib/supabase/business-client'
import {
  BusinessContext,
  type BusinessContextValue,
  type BusinessSessionState,
} from './businessContextValue'

/**
 * Establishes the "explicit business context" required by
 * ARCHITECTURE.md #15: every operational request under /business/:code
 * is wrapped in a provider bound to that ONE business's isolated Supabase
 * client. There is no ambient "current business" global — a component can
 * only reach data through the client this provider hands it, which is
 * physically a different database/project per business.
 *
 * Role is resolved from `staff_profiles.role` inside that business's own
 * database (not the central project), because role is a per-business
 * grant (Rule #12 — role + business assignment together decide access).
 */
export function BusinessProvider({ code, children }: { code: BusinessCode; children: ReactNode }) {
  const [state, setState] = useState<BusinessSessionState>({
    code,
    session: null,
    role: null,
    loading: true,
    configured: isBusinessConfigured(code),
  })

  useEffect(() => {
    const client = getBusinessClient(code)
    if (!client) {
      setState((s) => ({ ...s, loading: false, configured: false }))
      return
    }

    let active = true

    async function loadRole(session: Session | null) {
      if (!session) {
        if (active) setState((s) => ({ ...s, session: null, role: null, loading: false }))
        return
      }
      const { data, error } = await client!
        .from('staff_profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!active) return
      setState((s) => ({
        ...s,
        session,
        role: error ? null : ((data?.role as UserRole) ?? null),
        loading: false,
      }))
    }

    client.auth.getSession().then(({ data }) => loadRole(data.session))
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      loadRole(session)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [code])

  const value = useMemo<BusinessContextValue>(
    () => ({
      ...state,
      profile: BUSINESS_REGISTRY[code],
      async signIn(email, password) {
        const client = getBusinessClient(code)
        if (!client) return { error: 'This business portal is not configured yet.' }
        const { error } = await client.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },
      async signOut() {
        const client = getBusinessClient(code)
        if (client) await client.auth.signOut()
      },
    }),
    [state, code],
  )

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}
