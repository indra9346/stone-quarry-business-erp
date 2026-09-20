import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import type { BusinessCode } from '@/types/business'
import { BUSINESS_REGISTRY } from '@/types/business'
import type { StaffProfile } from '@/types/db'
import { allows, levelFor } from '@/lib/permissions'
import { getBusinessClient, isBusinessConfigured } from '@/lib/supabase/business-client'
import { BusinessContext, type AccessState, type BusinessContextValue } from './businessContextValue'

interface AuthState {
  session: Session | null
  staff: (Pick<StaffProfile, 'role' | 'status' | 'full_name'> & { permissions?: StaffProfile['permissions'] }) | null
  loading: boolean
  recovery: boolean
}

/**
 * Establishes the explicit business context: everything under
 * /business/:code is wrapped in a provider bound to that ONE business's
 * isolated Supabase client (physically a different project per business).
 * There is no ambient "current business" — components reach data only
 * through the client this provider hands them.
 *
 * The role comes from `staff_profiles` in THAT business's own database. RLS
 * only lets an ACTIVE staff member read the roster, so an inactive or
 * never-granted user simply gets no profile back and lands on "no access".
 * The database's RLS stays the real authority; this is for routing/UX.
 */
export function BusinessProvider({ code, children }: { code: BusinessCode; children: ReactNode }) {
  const queryClient = useQueryClient()
  const configured = isBusinessConfigured(code)
  const client = useMemo(() => (configured ? getBusinessClient(code) : null), [code, configured])
  const [auth, setAuth] = useState<AuthState>({
    session: null,
    staff: null,
    loading: configured,
    recovery: false,
  })

  useEffect(() => {
    if (!client) return
    let active = true

    async function resolve(session: Session | null, recovery?: boolean) {
      if (!session) {
        if (active) setAuth((s) => ({ session: null, staff: null, loading: false, recovery: recovery ?? s.recovery }))
        return
      }
      type Row = { data: AuthState['staff']; error: unknown }
      const withPermissions = (await client!
        .from('staff_profiles')
        .select('role,status,full_name,permissions')
        .eq('user_id', session.user.id)
        .maybeSingle()) as Row
      // A project that has not had migration 013 yet has no `permissions` column:
      // fall back to role-only access instead of locking everyone out.
      const { data, error } = withPermissions.error
        ? ((await client!
            .from('staff_profiles')
            .select('role,status,full_name')
            .eq('user_id', session.user.id)
            .maybeSingle()) as Row)
        : withPermissions
      if (!active) return
      setAuth((s) => ({
        session,
        staff: error || !data || data.status !== 'active' ? null : (data as AuthState['staff']),
        loading: false,
        recovery: recovery ?? s.recovery,
      }))
    }

    void client.auth.getSession().then(({ data }) => resolve(data.session))
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      // Do not call Supabase inside this callback synchronously (it can
      // deadlock the auth lock); defer to the next tick.
      setTimeout(() => void resolve(session, event === 'PASSWORD_RECOVERY' ? true : undefined), 0)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [client])

  const value = useMemo<BusinessContextValue>(() => {
    let accessState: AccessState
    if (!configured) accessState = 'unconfigured'
    else if (auth.loading) accessState = 'loading'
    else if (!auth.session) accessState = 'signed_out'
    else if (!auth.staff) accessState = 'no_access'
    else accessState = 'ready'

    const role = auth.staff?.role ?? null
    return {
      code,
      profile: BUSINESS_REGISTRY[code],
      configured,
      accessState,
      client,
      session: auth.session,
      userId: auth.session?.user.id ?? null,
      email: auth.session?.user.email ?? null,
      fullName: auth.staff?.full_name ?? null,
      role,
      isAdmin: role === 'admin',
      permissions: auth.staff?.permissions ?? null,
      can: (module, need = 'view') => allows(levelFor(role, auth.staff?.permissions ?? null, module), need),
      recovery: auth.recovery,
      async signIn(email, password) {
        if (!client) return { error: 'This business portal is not configured yet.' }
        const { error } = await client.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },
      async signOut() {
        if (client) await client.auth.signOut()
        // Never let one session's cached rows outlive it.
        queryClient.removeQueries({ queryKey: ['biz', code] })
      },
      async requestPasswordReset(email) {
        if (!client) return { error: 'This business portal is not configured yet.' }
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/business/${code}/reset-password`,
        })
        return { error: error?.message ?? null }
      },
      async updatePassword(password) {
        if (!client) return { error: 'This business portal is not configured yet.' }
        const { error } = await client.auth.updateUser({ password })
        return { error: error?.message ?? null }
      },
    }
  }, [auth, client, code, configured, queryClient])

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}
