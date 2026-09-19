import type { SupabaseClient } from '@supabase/supabase-js'
import type { Expense, LedgerEntry, Payment, PaymentMode } from '@/types/db'
import { ok, okVoid, pageRange, type Page } from './common'

/* --------------------------------------------------------------- payments
 * A payment is money received FROM A CUSTOMER. Created only by record_payment();
 * nothing here (or anywhere) routes money by phone number. */

export interface PaymentRow extends Payment {
  customers: { customer_name: string } | null
  bills: { bill_number: string; bill_type: string } | null
}

export async function listPayments(
  c: SupabaseClient,
  f: { customerId?: string; from?: string; to?: string; page: number },
): Promise<Page<PaymentRow>> {
  let q = c.from('payments').select('*, customers(customer_name), bills(bill_number, bill_type)', { count: 'exact' })
  if (f.customerId) q = q.eq('customer_id', f.customerId)
  if (f.from) q = q.gte('payment_date', f.from)
  if (f.to) q = q.lte('payment_date', f.to)
  const [from, to] = pageRange(f.page)
  const res = await q.order('payment_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
  if (res.error) throw new Error(res.error.message)
  return { rows: (res.data ?? []) as PaymentRow[], total: res.count ?? 0 }
}

export interface RecordPaymentInput {
  customerId: string | null
  billId: string | null
  amount: number
  mode: PaymentMode
  reference: string | null
  notes: string | null
  date: string
  /** Makes a retried submit return the original payment instead of a second one. */
  idempotencyKey: string
}

export async function recordPayment(c: SupabaseClient, i: RecordPaymentInput): Promise<Payment> {
  return ok(
    await c.rpc('record_payment', {
      p_customer_id: i.customerId,
      p_bill_id: i.billId,
      p_amount: i.amount,
      p_payment_mode: i.mode,
      p_reference_number: i.reference,
      p_notes: i.notes,
      p_payment_date: i.date,
      p_idempotency_key: i.idempotencyKey,
    }),
  ) as Payment
}

/** Posted, active bills for a customer that still owe money. */
export async function openBillsForCustomer(c: SupabaseClient, customerId: string) {
  return ok(
    await c
      .from('bills')
      .select('id, bill_number, bill_type, bill_date, grand_total, amount_received, balance_due')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .not('ledger_posted_at', 'is', null)
      .gt('balance_due', 0)
      .order('bill_date'),
  ) as { id: string; bill_number: string; bill_type: string; bill_date: string; grand_total: number; amount_received: number; balance_due: number }[]
}

/* ----------------------------------------------------------------- ledger */
export async function listLedger(
  c: SupabaseClient,
  f: { customerId: string; from?: string; to?: string; page: number },
): Promise<Page<LedgerEntry>> {
  let q = c.from('customer_ledger').select('*', { count: 'exact' }).eq('customer_id', f.customerId)
  if (f.from) q = q.gte('transaction_date', f.from)
  if (f.to) q = q.lte('transaction_date', f.to)
  const [from, to] = pageRange(f.page)
  const res = await q.order('entry_seq', { ascending: false }).range(from, to)
  if (res.error) throw new Error(res.error.message)
  return { rows: (res.data ?? []) as LedgerEntry[], total: res.count ?? 0 }
}

/** Current outstanding = the customer's latest running balance (admin only — RLS). */
export async function ledgerBalance(c: SupabaseClient, customerId: string): Promise<number | null> {
  const res = await c
    .from('customer_ledger')
    .select('running_balance')
    .eq('customer_id', customerId)
    .order('entry_seq', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (res.error) throw new Error(res.error.message)
  return res.data ? Number((res.data as { running_balance: number }).running_balance) : 0
}

export async function ledgerAdjustment(
  c: SupabaseClient,
  i: { customerId: string; type: 'opening_balance' | 'adjustment'; debit: number | null; credit: number | null; description: string },
): Promise<void> {
  okVoid(
    await c.rpc('record_ledger_adjustment', {
      p_customer_id: i.customerId,
      p_transaction_type: i.type,
      p_debit: i.debit,
      p_credit: i.credit,
      p_description: i.description,
    }),
  )
}

/* --------------------------------------------------------------- expenses */
export async function listExpenses(
  c: SupabaseClient,
  f: { category?: string; from?: string; to?: string; page: number },
): Promise<Page<Expense>> {
  let q = c.from('expenses').select('*', { count: 'exact' })
  if (f.category) q = q.eq('category', f.category)
  if (f.from) q = q.gte('expense_date', f.from)
  if (f.to) q = q.lte('expense_date', f.to)
  const [from, to] = pageRange(f.page)
  const res = await q.order('expense_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
  if (res.error) throw new Error(res.error.message)
  return { rows: (res.data ?? []) as Expense[], total: res.count ?? 0 }
}

/** Category totals for a date range (fetches only category+amount). */
export async function expenseSummary(c: SupabaseClient, f: { from?: string; to?: string }) {
  let q = c.from('expenses').select('category, amount')
  if (f.from) q = q.gte('expense_date', f.from)
  if (f.to) q = q.lte('expense_date', f.to)
  const rows = ok(await q.limit(5000)) as { category: string; amount: number }[]
  const byCategory = new Map<string, number>()
  let total = 0
  for (const r of rows) {
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + Number(r.amount))
    total += Number(r.amount)
  }
  return { total, byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]), count: rows.length }
}

export type ExpenseInput = Omit<Expense, 'id' | 'created_at'>

export async function createExpense(c: SupabaseClient, e: ExpenseInput): Promise<void> {
  okVoid(await c.from('expenses').insert(e))
}
