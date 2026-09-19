import type { SupabaseClient } from '@supabase/supabase-js'
import { ok } from './common'

const sum = (rows: Record<string, unknown>[], key: string) => rows.reduce((s, r) => s + Number(r[key] ?? 0), 0)

export interface Kpis {
  salesToday: number
  billsToday: number
  outstanding: number
  openBills: number
  paymentsToday: number
  stockItems: number
  stockEmpty: number
  vehiclesActive: number
  vehiclesOnTrip: number
  pendingQuotations: number
}

/** "Sales" = ACTIVE (non-cancelled) bills dated today — draft or posted. */
export async function loadKpis(c: SupabaseClient, today: string): Promise<Kpis> {
  const [sales, open, pays, stock, vehicles, quotes] = await Promise.all([
    c.from('bills').select('grand_total').eq('bill_date', today).eq('status', 'active').limit(5000),
    c.from('bills').select('balance_due').eq('status', 'active').not('ledger_posted_at', 'is', null).gt('balance_due', 0).limit(20000),
    c.from('payments').select('amount').eq('payment_date', today).limit(5000),
    c.from('stock_balances').select('quantity_on_hand'),
    c.from('vehicles').select('status'),
    c.from('quotations').select('id', { count: 'exact', head: true }).in('status', ['draft', 'sent']),
  ])
  const salesRows = ok(sales) as Record<string, unknown>[]
  const openRows = ok(open) as Record<string, unknown>[]
  const payRows = ok(pays) as Record<string, unknown>[]
  const stockRows = ok(stock) as { quantity_on_hand: number }[]
  const vehicleRows = ok(vehicles) as { status: string }[]
  if (quotes.error) throw new Error(quotes.error.message)
  return {
    salesToday: sum(salesRows, 'grand_total'),
    billsToday: salesRows.length,
    outstanding: sum(openRows, 'balance_due'),
    openBills: openRows.length,
    paymentsToday: sum(payRows, 'amount'),
    stockItems: stockRows.length,
    stockEmpty: stockRows.filter((s) => Number(s.quantity_on_hand) === 0).length,
    vehiclesActive: vehicleRows.filter((v) => v.status !== 'inactive').length,
    vehiclesOnTrip: vehicleRows.filter((v) => v.status === 'on_trip').length,
    pendingQuotations: quotes.count ?? 0,
  }
}

/** Sales per day (active bills) over a date range. */
export async function salesByDay(c: SupabaseClient, from: string, to: string) {
  const rows = ok(
    await c.from('bills').select('bill_date, grand_total').eq('status', 'active').gte('bill_date', from).lte('bill_date', to).limit(20000),
  ) as { bill_date: string; grand_total: number }[]
  const map = new Map<string, number>()
  for (const r of rows) map.set(r.bill_date, (map.get(r.bill_date) ?? 0) + Number(r.grand_total))
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, total]) => ({ date, total }))
}

export async function recentActivity(c: SupabaseClient) {
  const [bills, quotes, pays, trips] = await Promise.all([
    c.from('bills').select('id, bill_number, bill_type, bill_date, grand_total, status, ledger_posted_at, customers(customer_name)').order('created_at', { ascending: false }).limit(6),
    c.from('quotations').select('id, quotation_number, quotation_date, grand_total, status, customers(customer_name)').order('created_at', { ascending: false }).limit(5),
    c.from('payments').select('id, payment_number, payment_date, amount, customers(customer_name)').order('created_at', { ascending: false }).limit(5),
    c.from('trips').select('id, trip_number, trip_date, status, destination, vehicles(registration_number)').order('created_at', { ascending: false }).limit(5),
  ])
  return {
    bills: ok(bills) as unknown as {
      id: string
      bill_number: string
      bill_type: 'normal' | 'ev'
      bill_date: string
      grand_total: number
      status: 'active' | 'cancelled'
      ledger_posted_at: string | null
      customers: { customer_name: string } | null
    }[],
    quotations: ok(quotes) as unknown as {
      id: string
      quotation_number: string
      quotation_date: string
      grand_total: number
      status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'
      customers: { customer_name: string } | null
    }[],
    payments: ok(pays) as unknown as { id: string; payment_number: string; payment_date: string; amount: number; customers: { customer_name: string } | null }[],
    trips: ok(trips) as unknown as { id: string; trip_number: string; trip_date: string; status: string; destination: string | null; vehicles: { registration_number: string } | null }[],
  }
}
