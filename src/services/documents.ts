import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  MeasurementRow,
  MeasurementSheet,
  MeasurementVerification,
  Quotation,
  QuotationItem,
  QuotationStatus,
} from '@/types/db'
import { round2 } from '@/lib/format'
import { likeTerm, ok, okVoid, pageRange, type Page } from './common'
import { lineAmount, type BillItemInput } from './bills'

/* -------------------------------------------------------------- quotations
 * PROVISIONAL module: no real quotation document has been supplied, so number
 * format, expiry, tax handling and workflow are scaffold defaults. */

export interface QuotationRow extends Quotation {
  customers: { customer_name: string } | null
}

export async function listQuotations(
  c: SupabaseClient,
  f: { q?: string; status?: QuotationStatus; customerId?: string; from?: string; to?: string; page: number },
): Promise<Page<QuotationRow>> {
  let q = c.from('quotations').select('*, customers(customer_name)', { count: 'exact' })
  if (f.status) q = q.eq('status', f.status)
  if (f.customerId) q = q.eq('customer_id', f.customerId)
  if (f.q && likeTerm(f.q)) q = q.ilike('quotation_number', `%${likeTerm(f.q)}%`)
  if (f.from) q = q.gte('quotation_date', f.from)
  if (f.to) q = q.lte('quotation_date', f.to)
  const [from, to] = pageRange(f.page)
  const res = await q.order('quotation_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
  if (res.error) throw new Error(res.error.message)
  return { rows: (res.data ?? []) as QuotationRow[], total: res.count ?? 0 }
}

export interface QuotationDetail {
  quotation: Quotation & { customers: { id: string; customer_name: string; gstin: string | null; billing_address: string | null; phone: string | null } | null }
  items: QuotationItem[]
}

export async function getQuotation(c: SupabaseClient, id: string): Promise<QuotationDetail> {
  const quotation = ok(
    await c.from('quotations').select('*, customers(id, customer_name, gstin, billing_address, phone)').eq('id', id).single(),
  ) as QuotationDetail['quotation']
  const items = ok(await c.from('quotation_items').select('*').eq('quotation_id', id).order('sort_order')) as QuotationItem[]
  return { quotation, items }
}

export interface QuotationInput {
  quotation_number: string
  customer_id: string
  quotation_date: string
  valid_until: string | null
  status: QuotationStatus
  discount_amount: number
  tax_amount: number
  other_charges: number
  notes: string | null
  terms: string | null
  items: BillItemInput[]
}

/** Totals sent to the database (its CHECK requires grand = subtotal − discount + tax + other). */
export function quotationTotals(i: Pick<QuotationInput, 'items' | 'discount_amount' | 'tax_amount' | 'other_charges'>) {
  const subtotal = round2(i.items.reduce((s, it) => s + (lineAmount(it) ?? 0), 0))
  return { subtotal, grand_total: round2(subtotal - i.discount_amount + i.tax_amount + i.other_charges) }
}

function qHeader(input: QuotationInput) {
  const { items, ...h } = input
  return { ...h, ...quotationTotals({ items, discount_amount: h.discount_amount, tax_amount: h.tax_amount, other_charges: h.other_charges }) }
}
function qItems(id: string, items: BillItemInput[]) {
  return items.map((it, idx) => ({
    quotation_id: id,
    description: it.description,
    hsn_code: it.hsn_code,
    quantity: it.quantity,
    unit: it.unit,
    rate: it.rate,
    amount: lineAmount(it),
    sort_order: idx,
  }))
}

export async function createQuotation(c: SupabaseClient, input: QuotationInput): Promise<Quotation> {
  const q = ok(await c.from('quotations').insert(qHeader(input)).select().single()) as Quotation
  if (input.items.length > 0) {
    const res = await c.from('quotation_items').insert(qItems(q.id, input.items))
    if (res.error) {
      await c.from('quotations').delete().eq('id', q.id)
      throw new Error(`Quotation lines could not be saved: ${res.error.message}`)
    }
  }
  return q
}

export async function updateQuotation(c: SupabaseClient, id: string, input: QuotationInput): Promise<void> {
  okVoid(await c.from('quotations').update(qHeader(input)).eq('id', id))
  okVoid(await c.from('quotation_items').delete().eq('quotation_id', id))
  if (input.items.length > 0) okVoid(await c.from('quotation_items').insert(qItems(id, input.items)))
}

export async function setQuotationStatus(c: SupabaseClient, id: string, status: QuotationStatus): Promise<void> {
  okVoid(await c.from('quotations').update({ status }).eq('id', id))
}

/* -------------------------------------------------------- measurement sheets
 * Independent documents, stored EXACTLY as written. No formula, no unit, no link. */

export interface MeasurementRowInput {
  measurement_text: string
  pcs_text: string | null
  quantity: number | null
  rate: number | null
  amount: number | null
}

export interface MeasurementInput {
  sheet_number: string | null
  sheet_date: string | null
  customer_id: string | null
  party_name_text: string | null
  stated_total: number | null
  notes: string | null
  rows: MeasurementRowInput[]
}

export async function listSheets(c: SupabaseClient, f: { q?: string; page: number }): Promise<Page<MeasurementSheet & { row_count: number }>> {
  let q = c.from('measurement_sheets').select('*, measurement_sheet_rows(count)', { count: 'exact' })
  const t = f.q ? likeTerm(f.q) : ''
  if (t) q = q.or(`sheet_number.ilike.%${t}%,party_name_text.ilike.%${t}%`)
  const [from, to] = pageRange(f.page)
  const res = await q.order('sheet_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).range(from, to)
  if (res.error) throw new Error(res.error.message)
  const rows = (res.data ?? []).map((r) => {
    const { measurement_sheet_rows, ...sheet } = r as MeasurementSheet & { measurement_sheet_rows: { count: number }[] }
    return { ...sheet, row_count: measurement_sheet_rows[0]?.count ?? 0 }
  })
  return { rows, total: res.count ?? 0 }
}

export interface SheetDetail {
  sheet: MeasurementSheet & { customers: { customer_name: string } | null }
  rows: MeasurementRow[]
  verification: MeasurementVerification | null
}

export async function getSheet(c: SupabaseClient, id: string): Promise<SheetDetail> {
  const sheet = ok(await c.from('measurement_sheets').select('*, customers(customer_name)').eq('id', id).single()) as SheetDetail['sheet']
  const rows = ok(await c.from('measurement_sheet_rows').select('*').eq('sheet_id', id).order('sort_order').order('row_no')) as MeasurementRow[]
  const v = await c.from('measurement_sheet_verification').select('*').eq('sheet_id', id).maybeSingle()
  return { sheet, rows, verification: v.error ? null : (v.data as MeasurementVerification | null) }
}

function sheetRows(id: string, rows: MeasurementRowInput[]) {
  return rows.map((r, i) => ({ sheet_id: id, row_no: i + 1, sort_order: i + 1, ...r }))
}

export async function createSheet(c: SupabaseClient, input: MeasurementInput): Promise<MeasurementSheet> {
  const { rows, ...header } = input
  const s = ok(await c.from('measurement_sheets').insert(header).select().single()) as MeasurementSheet
  if (rows.length > 0) {
    const res = await c.from('measurement_sheet_rows').insert(sheetRows(s.id, rows))
    if (res.error) {
      await c.from('measurement_sheets').delete().eq('id', s.id)
      throw new Error(`Rows could not be saved: ${res.error.message}`)
    }
  }
  return s
}

export async function updateSheet(c: SupabaseClient, id: string, input: MeasurementInput): Promise<void> {
  const { rows, ...header } = input
  okVoid(await c.from('measurement_sheets').update(header).eq('id', id))
  okVoid(await c.from('measurement_sheet_rows').delete().eq('sheet_id', id))
  if (rows.length > 0) okVoid(await c.from('measurement_sheet_rows').insert(sheetRows(id, rows)))
}
