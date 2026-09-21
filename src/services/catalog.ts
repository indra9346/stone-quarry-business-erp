import type { SupabaseClient } from '@supabase/supabase-js'
import type { Permissions } from '@/lib/permissions'
import type {
  AuditLog,
  Customer,
  Material,
  SettingRow,
  StaffProfile,
  Unit,
  Vehicle,
} from '@/types/db'
import { likeTerm, ok, okVoid, pageRange, type Page } from './common'

/* ------------------------------------------------------------------ units */
export async function listUnits(c: SupabaseClient): Promise<Unit[]> {
  return ok(await c.from('units').select('*').order('code')) as Unit[]
}
export async function createUnit(c: SupabaseClient, u: Unit): Promise<void> {
  okVoid(await c.from('units').insert(u))
}
export async function createUnits(c: SupabaseClient, units: Unit[]): Promise<void> {
  if (units.length) okVoid(await c.from('units').insert(units))
}
/** The code is the identity used by documents, so only the label and kind can change. */
export async function updateUnit(c: SupabaseClient, code: string, patch: Pick<Unit, 'label' | 'measurement_kind'>): Promise<void> {
  okVoid(await c.from('units').update(patch).eq('code', code))
}

/* -------------------------------------------------------------- materials */
export async function listMaterials(c: SupabaseClient): Promise<Material[]> {
  return ok(await c.from('materials').select('*').order('name')) as Material[]
}
export async function createMaterial(c: SupabaseClient, m: Omit<Material, 'id' | 'status'>): Promise<void> {
  okVoid(await c.from('materials').insert(m))
}

/* -------------------------------------------------------------- customers */
export type CustomerInput = Omit<Customer, 'id' | 'created_at' | 'customer_code'> & { customer_code?: string | null }

export async function listCustomers(
  c: SupabaseClient,
  f: { q?: string; page: number },
): Promise<Page<Customer>> {
  let q = c.from('customers').select('*', { count: 'exact' })
  const t = f.q ? likeTerm(f.q) : ''
  if (t) q = q.or(`customer_name.ilike.%${t}%,phone.ilike.%${t}%,company_name.ilike.%${t}%,gstin.ilike.%${t}%`)
  const [from, to] = pageRange(f.page)
  const res = await q.order('customer_name').range(from, to)
  if (res.error) throw new Error(res.error.message)
  return { rows: (res.data ?? []) as Customer[], total: res.count ?? 0 }
}

/** Compact list for pickers (first 500, alphabetical). */
export async function pickCustomers(c: SupabaseClient): Promise<Pick<Customer, 'id' | 'customer_name' | 'gstin' | 'billing_address'>[]> {
  return ok(
    await c.from('customers').select('id, customer_name, gstin, billing_address').eq('status', 'active').order('customer_name').limit(500),
  )
}

export async function getCustomer(c: SupabaseClient, id: string): Promise<Customer> {
  return ok(await c.from('customers').select('*').eq('id', id).single()) as Customer
}
export async function createCustomer(c: SupabaseClient, input: CustomerInput): Promise<Customer> {
  return ok(await c.from('customers').insert(input).select().single()) as Customer
}
export async function updateCustomer(c: SupabaseClient, id: string, input: Partial<CustomerInput>): Promise<void> {
  okVoid(await c.from('customers').update(input).eq('id', id))
}

/* ---------------------------------------------------------------- staff */
export async function listStaff(c: SupabaseClient): Promise<StaffProfile[]> {
  return ok(await c.from('staff_profiles').select('*').order('full_name')) as StaffProfile[]
}
export async function updateStaff(
  c: SupabaseClient,
  userId: string,
  patch: Partial<Pick<StaffProfile, 'role' | 'status' | 'full_name' | 'phone' | 'permissions'>>,
): Promise<void> {
  okVoid(await c.from('staff_profiles').update(patch).eq('user_id', userId))
}
export async function createStaffProfile(
  c: SupabaseClient,
  p: Pick<StaffProfile, 'user_id' | 'full_name' | 'role' | 'phone'> & { permissions?: Permissions | null },
): Promise<void> {
  const { permissions, ...rest } = p
  // `permissions` is only sent when set, so this still works on a project without migration 013.
  okVoid(await c.from('staff_profiles').insert({ ...rest, ...(permissions ? { permissions } : {}), status: 'active' }))
}

/** Creates a login + role through the create-staff Edge Function (admin only, server-checked). */
export async function createStaffLogin(
  c: SupabaseClient,
  p: { email: string; password: string; full_name: string; role: 'admin' | 'staff'; permissions?: Permissions | null },
): Promise<void> {
  const { error } = await c.functions.invoke('create-staff', { body: p })
  if (!error) return
  let message = error.message
  const response = (error as { context?: Response }).context
  if (response && typeof response.clone === 'function') {
    try {
      const body = (await response.clone().json()) as { error?: string }
      if (body.error) message = body.error
    } catch { /* keep the generic message */ }
    if (response.status === 404) message = 'Creating logins is not switched on for this business yet (the create-staff function has not been deployed).'
  }
  throw new Error(message)
}

/* -------------------------------------------------------------- settings */
export async function listSettings(c: SupabaseClient): Promise<Record<string, Record<string, unknown>>> {
  const rows = ok(await c.from('settings').select('*')) as SettingRow[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}
export async function saveSetting(c: SupabaseClient, key: string, value: Record<string, unknown>): Promise<void> {
  okVoid(await c.from('settings').update({ value }).eq('key', key))
}

/* -------------------------------------------------------------- audit log */
export interface AuditFilters {
  module?: string
  action?: string
  from?: string
  to?: string
  page: number
}
export async function listAudit(c: SupabaseClient, f: AuditFilters): Promise<Page<AuditLog>> {
  let q = c.from('audit_logs').select('*', { count: 'exact' })
  if (f.module) q = q.eq('module', f.module)
  if (f.action) q = q.eq('action', f.action)
  if (f.from) q = q.gte('created_at', `${f.from}T00:00:00+05:30`)
  if (f.to) q = q.lte('created_at', `${f.to}T23:59:59.999+05:30`)
  const [from, to] = pageRange(f.page)
  const res = await q.order('created_at', { ascending: false }).range(from, to)
  if (res.error) throw new Error(res.error.message)
  return { rows: (res.data ?? []) as AuditLog[], total: res.count ?? 0 }
}

/** user_id -> name lookup for audit/actor columns. */
export async function staffNames(c: SupabaseClient): Promise<Record<string, string>> {
  const rows = ok(await c.from('staff_profiles').select('user_id, full_name')) as Pick<StaffProfile, 'user_id' | 'full_name'>[]
  return Object.fromEntries(rows.map((r) => [r.user_id, r.full_name]))
}

export async function pickVehicles(c: SupabaseClient): Promise<Pick<Vehicle, 'id' | 'registration_number' | 'vehicle_type'>[]> {
  return ok(await c.from('vehicles').select('id, registration_number, vehicle_type').neq('status', 'inactive').order('registration_number'))
}
