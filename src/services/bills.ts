import type { SupabaseClient } from '@supabase/supabase-js'
import type { Bill, BillItem, BillState, BillType, Payment } from '@/types/db'
import { round2 } from '@/lib/format'
import { likeTerm, ok, okVoid, pageRange, PAGE_SIZE, type Page } from './common'

export interface BillRow extends Bill {
  customers: { customer_name: string } | null
}

export interface BillFilters {
  type?: BillType
  q?: string
  state?: BillState | 'all'
  customerId?: string
  from?: string
  to?: string
  page: number
}

export async function listBills(c: SupabaseClient, f: BillFilters): Promise<Page<BillRow>> {
  let q = c.from('bills').select('*, customers(customer_name)', { count: 'exact' })
  if (f.type) q = q.eq('bill_type', f.type)
  if (f.customerId) q = q.eq('customer_id', f.customerId)
  if (f.q && likeTerm(f.q)) q = q.ilike('bill_number', `%${likeTerm(f.q)}%`)
  if (f.from) q = q.gte('bill_date', f.from)
  if (f.to) q = q.lte('bill_date', f.to)
  if (f.state === 'draft') q = q.eq('status', 'active').is('ledger_posted_at', null)
  if (f.state === 'posted') q = q.eq('status', 'active').not('ledger_posted_at', 'is', null)
  if (f.state === 'cancelled') q = q.eq('status', 'cancelled')
  const [from, to] = pageRange(f.page)
  const res = await q.order('bill_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
  if (res.error) throw new Error(res.error.message)
  return { rows: (res.data ?? []) as BillRow[], total: res.count ?? 0 }
}

export interface BillDetail {
  bill: Bill & { customers: { id: string; customer_name: string; gstin: string | null; billing_address: string | null; phone: string | null } | null }
  items: BillItem[]
  payments: Payment[]
}

export async function getBill(c: SupabaseClient, id: string): Promise<BillDetail> {
  const bill = ok(
    await c.from('bills').select('*, customers(id, customer_name, gstin, billing_address, phone)').eq('id', id).single(),
  ) as BillDetail['bill']
  const items = ok(await c.from('bill_items').select('*').eq('bill_id', id).order('sort_order')) as BillItem[]
  const payments = ok(await c.from('payments').select('*').eq('bill_id', id).order('created_at')) as Payment[]
  return { bill, items, payments }
}

export interface BillItemInput {
  description: string
  hsn_code: string | null
  quantity: number | null
  unit: string | null
  rate: number | null
}

export interface BillInput {
  bill_type: BillType
  bill_number: string
  bill_number_source: 'manual' | 'generated'
  customer_id: string
  bill_date: string
  party_name: string | null
  party_address: string | null
  party_gstin: string | null
  eway_bill_number: string | null
  vehicle_number: string | null
  vehicle_id: string | null
  cgst_percent: number | null
  sgst_percent: number | null
  igst_percent: number | null
  discount_amount: number | null
  other_charges: number | null
  notes: string | null
  items: BillItemInput[]
}

/** A line is descriptive (all three NULL) or fully priced; amount = round(qty × rate, 2). */
export function lineAmount(i: Pick<BillItemInput, 'quantity' | 'rate'>): number | null {
  return i.quantity !== null && i.rate !== null ? round2(i.quantity * i.rate) : null
}

function headerPayload(input: BillInput) {
  const { items: _items, ...header } = input
  void _items
  return header
}

function itemRows(billId: string, items: BillItemInput[]) {
  return items.map((it, idx) => ({
    bill_id: billId,
    description: it.description,
    hsn_code: it.hsn_code,
    quantity: it.quantity,
    unit: it.unit,
    rate: it.rate,
    amount: lineAmount(it),
    sort_order: idx,
  }))
}

export async function createBill(c: SupabaseClient, input: BillInput): Promise<Bill> {
  const bill = ok(await c.from('bills').insert(headerPayload(input)).select().single()) as Bill
  if (input.items.length > 0) {
    const res = await c.from('bill_items').insert(itemRows(bill.id, input.items))
    if (res.error) {
      // Not transactional from the browser: remove the empty draft if we may.
      await c.from('bills').delete().eq('id', bill.id)
      throw new Error(`Bill lines could not be saved: ${res.error.message}`)
    }
  }
  return bill
}

/** Draft bills only — the database freezes a posted/cancelled bill. */
export async function updateBill(c: SupabaseClient, id: string, input: BillInput): Promise<void> {
  okVoid(await c.from('bills').update(headerPayload(input)).eq('id', id))
  okVoid(await c.from('bill_items').delete().eq('bill_id', id))
  if (input.items.length > 0) okVoid(await c.from('bill_items').insert(itemRows(id, input.items)))
}

export async function postBill(c: SupabaseClient, id: string): Promise<void> {
  okVoid(await c.rpc('post_bill_to_ledger', { p_bill_id: id }))
}

export async function cancelBill(c: SupabaseClient, id: string, reason: string): Promise<void> {
  okVoid(await c.rpc('cancel_bill', { p_bill_id: id, p_reason: reason }))
}

export async function deleteDraftBill(c: SupabaseClient, id: string): Promise<void> {
  okVoid(await c.from('bills').delete().eq('id', id))
}

export async function generateNumber(c: SupabaseClient, documentType: string, prefix: string): Promise<string> {
  return ok(await c.rpc('next_document_number', { p_document_type: documentType, p_prefix: prefix })) as string
}

export { PAGE_SIZE }
