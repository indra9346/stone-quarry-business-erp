import type { SupabaseClient } from '@supabase/supabase-js'
import type { Driver, StockBalance, StockMovement, StockMovementType, Trip, TripStatus, Vehicle } from '@/types/db'
import { ok, okVoid, pageRange, type Page } from './common'

/* ------------------------------------------------------------------ stock
 * Movement-based: Opening + Received − Used/Sold ± Adjustments = Current.
 * quantity_on_hand changes ONLY through apply_stock_movement(). No unit is assumed. */

export interface StockRow extends StockBalance {
  materials: { name: string; category: string } | null
}

export async function listStock(c: SupabaseClient, f: { category?: string; q?: string }): Promise<StockRow[]> {
  const res = await c.from('stock_balances').select('*').order('material_id')
  const balances = ok(res) as StockBalance[]
  const mats = ok(await c.from('materials').select('id, name, category')) as { id: string; name: string; category: string }[]
  const byId = new Map(mats.map((m) => [m.id, m]))
  let rows: StockRow[] = balances.map((b) => {
    const m = byId.get(b.material_id)
    return { ...b, materials: m ? { name: m.name, category: m.category } : null }
  })
  if (f.category) rows = rows.filter((r) => r.materials?.category === f.category)
  if (f.q) {
    const t = f.q.toLowerCase()
    rows = rows.filter((r) => (r.materials?.name ?? '').toLowerCase().includes(t) || (r.batch_code ?? '').toLowerCase().includes(t))
  }
  return rows.sort((a, b) => (a.materials?.name ?? '').localeCompare(b.materials?.name ?? ''))
}

export async function getStockItem(c: SupabaseClient, id: string) {
  const balance = ok(await c.from('stock_balances').select('*').eq('stock_item_id', id).single()) as StockBalance
  const material = ok(await c.from('materials').select('id, name, category, hsn_code').eq('id', balance.material_id).single()) as {
    id: string
    name: string
    category: string
    hsn_code: string | null
  }
  return { balance, material }
}

export async function listMovements(c: SupabaseClient, f: { stockItemId: string; page: number }): Promise<Page<StockMovement>> {
  const [from, to] = pageRange(f.page)
  const res = await c
    .from('stock_movements')
    .select('*', { count: 'exact' })
    .eq('stock_item_id', f.stockItemId)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (res.error) throw new Error(res.error.message)
  return { rows: (res.data ?? []) as StockMovement[], total: res.count ?? 0 }
}

export async function createStockItem(
  c: SupabaseClient,
  i: { material_id: string; batch_code: string | null; location: string | null; unit: string | null },
): Promise<void> {
  okVoid(await c.from('stock_items').insert(i))
}

export async function applyMovement(
  c: SupabaseClient,
  i: { stockItemId: string; type: StockMovementType; change: number; reason: string | null },
): Promise<void> {
  okVoid(
    await c.rpc('apply_stock_movement', {
      p_stock_item_id: i.stockItemId,
      p_movement_type: i.type,
      p_quantity_change: i.change,
      p_reference_type: 'manual',
      p_reference_id: null,
      p_reason: i.reason,
    }),
  )
}

/* -------------------------------------------------------------- transport */
export async function listVehicles(c: SupabaseClient): Promise<Vehicle[]> {
  return ok(await c.from('vehicles').select('*').order('registration_number')) as Vehicle[]
}
export async function saveVehicle(c: SupabaseClient, id: string | null, v: Omit<Vehicle, 'id'>): Promise<void> {
  okVoid(id ? await c.from('vehicles').update(v).eq('id', id) : await c.from('vehicles').insert(v))
}

export async function listDrivers(c: SupabaseClient): Promise<Driver[]> {
  return ok(await c.from('drivers').select('*').order('driver_name')) as Driver[]
}
export async function saveDriver(c: SupabaseClient, id: string | null, d: Omit<Driver, 'id'>): Promise<void> {
  okVoid(id ? await c.from('drivers').update(d).eq('id', id) : await c.from('drivers').insert(d))
}

export interface TripRow extends Trip {
  vehicles: { registration_number: string } | null
  drivers: { driver_name: string } | null
  customers: { customer_name: string } | null
}

export async function listTrips(
  c: SupabaseClient,
  f: { status?: TripStatus; vehicleId?: string; from?: string; to?: string; page: number },
): Promise<Page<TripRow>> {
  let q = c.from('trips').select('*, vehicles(registration_number), drivers(driver_name), customers(customer_name)', { count: 'exact' })
  if (f.status) q = q.eq('status', f.status)
  if (f.vehicleId) q = q.eq('vehicle_id', f.vehicleId)
  if (f.from) q = q.gte('trip_date', f.from)
  if (f.to) q = q.lte('trip_date', f.to)
  const [from, to] = pageRange(f.page)
  const res = await q.order('trip_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
  if (res.error) throw new Error(res.error.message)
  return { rows: (res.data ?? []) as TripRow[], total: res.count ?? 0 }
}

export type TripInput = Omit<Trip, 'id' | 'created_at'>

export async function saveTrip(c: SupabaseClient, id: string | null, t: TripInput): Promise<void> {
  okVoid(id ? await c.from('trips').update(t).eq('id', id) : await c.from('trips').insert(t))
}
