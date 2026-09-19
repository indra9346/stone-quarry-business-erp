/**
 * End-to-end smoke test of the REAL frontend service layer against the deployed
 * KMG Supabase project, using only the public URL + anon key and a normal user
 * login. It cannot bypass RLS and never uses a service-role key.
 *
 *   PowerShell:
 *     $env:TEST_EMAIL = 'you@example.com'          # a KMG staff/admin login
 *     $env:TEST_PASSWORD = '…'                      # typed by you, never shared
 *     npm run smoke:kmg                             # read-only
 *     $env:SMOKE_WRITE = '1'; npm run smoke:kmg     # + writes (clearly marked TEST records)
 *
 * Write mode creates records named "TEST …" / "ZZ TEST …" and never touches
 * existing rows. Posted/paid records cannot be deleted by design (ledger and
 * audit history), so the test customer's ledger is netted back to zero: one bill
 * is cancelled, the other is paid in full. It consumes one payment number.
 */
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cancelBill, createBill, getBill, listBills, postBill, updateBill, type BillInput } from '@/services/bills'
import { createCustomer, listAudit, listCustomers } from '@/services/catalog'
import { createQuotation, getQuotation, listQuotations, listSheets, quotationTotals } from '@/services/documents'
import { expenseSummary, ledgerBalance, listExpenses, listLedger, listPayments, recordPayment } from '@/services/finance'
import { loadKpis, recentActivity } from '@/services/dashboard'
import { applyMovement, listDrivers, listStock, listTrips, listVehicles } from '@/services/operations'
import { todayIST } from '@/lib/format'

const env: Record<string, string> = {}
try {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m) env[m[1]!] = m[2]!
  }
} catch {
  /* fall through to process.env */
}
const URL = process.env.VITE_KMG_SUPABASE_URL ?? env.VITE_KMG_SUPABASE_URL
const KEY = process.env.VITE_KMG_SUPABASE_ANON_KEY ?? env.VITE_KMG_SUPABASE_ANON_KEY
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD
const WRITE = process.env.SMOKE_WRITE === '1'

let pass = 0
let fail = 0
let skip = 0
const failures: string[] = []
const say = (tag: string, name: string, extra = '') => console.log(`  ${tag.padEnd(5)} ${name}${extra ? `\n         ${extra}` : ''}`)
async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const r = await fn()
    pass++
    say('ok', name)
    return r
  } catch (e) {
    fail++
    const msg = e instanceof Error ? e.message : JSON.stringify(e)
    failures.push(`${name}: ${msg}`)
    say('FAIL', name, msg)
    return undefined
  }
}
/** The operation MUST be rejected by the database. */
async function mustReject(name: string, fn: () => Promise<unknown>, re?: RegExp) {
  try {
    await fn()
    fail++
    failures.push(`${name}: succeeded but should have been rejected`)
    say('FAIL', name, 'succeeded but should have been rejected')
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e)
    if (re && !re.test(msg)) {
      fail++
      failures.push(`${name}: rejected with unexpected error: ${msg}`)
      say('FAIL', name, `unexpected error: ${msg}`)
    } else {
      pass++
      say('ok', name, `rejected: ${msg.slice(0, 90)}`)
    }
  }
}
const need = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(msg)
}
const skipped = (name: string, why: string) => {
  skip++
  say('skip', name, why)
}

async function main() {
  need(URL && KEY, 'Missing VITE_KMG_SUPABASE_URL / VITE_KMG_SUPABASE_ANON_KEY (.env.local).')
  console.log(`\nKMG project: ${new globalThis.URL(URL!).host}`)
  const mk = () => createClient(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

  /* ------------------------------------------------------------ unauthorised */
  console.log('\n== Unauthorised (anon key, no login) ==')
  const anon = mk()
  for (const t of ['staff_profiles', 'customers', 'bills', 'customer_ledger', 'expenses', 'audit_logs', 'stock_items', 'payments', 'measurement_sheets']) {
    await mustReject(`anon cannot read ${t}`, async () => {
      const r = await anon.from(t).select('*').limit(1)
      if (r.error) throw new Error(r.error.message)
      if ((r.data ?? []).length > 0) return // would be a leak
      throw new Error('empty result but no error — treated as blocked')
    })
  }
  await mustReject('anon cannot call record_payment', async () => {
    const r = await anon.rpc('record_payment', { p_customer_id: null, p_bill_id: null, p_amount: 1, p_payment_mode: 'cash' })
    if (r.error) throw new Error(r.error.message)
  })

  if (!EMAIL || !PASSWORD) {
    console.log('\nTEST_EMAIL / TEST_PASSWORD not set — skipping authenticated checks.')
    return
  }

  /* ---------------------------------------------------------------- sign in */
  console.log('\n== Authentication & business context ==')
  const c: SupabaseClient = mk()
  await step('sign in', async () => {
    const r = await c.auth.signInWithPassword({ email: EMAIL!, password: PASSWORD! })
    if (r.error) throw new Error(r.error.message)
  })
  const me = await step('resolve role from staff_profiles (this business only)', async () => {
    const { data: u } = await c.auth.getUser()
    const r = await c.from('staff_profiles').select('role,status,full_name').eq('user_id', u.user!.id).maybeSingle()
    if (r.error) throw new Error(r.error.message)
    need(r.data, 'No ACTIVE staff profile for this user in KMG (inactive, or never granted access).')
    return r.data as { role: 'admin' | 'staff'; status: string; full_name: string }
  })
  if (!me) return
  const admin = me.role === 'admin'
  console.log(`  role: ${me.role}`)

  /* ------------------------------------------------------------------ reads */
  console.log('\n== Reads ==')
  await step('dashboard KPIs', () => loadKpis(c, todayIST()))
  await step('dashboard recent activity', () => recentActivity(c))
  const bills = await step('bills list', () => listBills(c, { page: 0 }))
  await step('quotations list', () => listQuotations(c, { page: 0 }))
  await step('measurement sheets list', () => listSheets(c, { page: 0 }))
  const custs = await step('customers list', () => listCustomers(c, { page: 0 }))
  await step('payments list (read)', () => listPayments(c, { page: 0 }))
  await step('stock (read, movement-based view)', () => listStock(c, {}))
  await step('vehicles', () => listVehicles(c))
  await step('drivers', () => listDrivers(c))
  await step('trips', () => listTrips(c, { page: 0 }))
  console.log(`  (bills: ${bills?.total ?? '?'}, customers: ${custs?.total ?? '?'})`)

  console.log('\n== Role restrictions ==')
  if (admin) {
    const firstCustomer = custs?.rows[0]?.id
    await step('ledger readable (admin)', async () => {
      if (!firstCustomer) return []
      return listLedger(c, { customerId: firstCustomer, page: 0 })
    })
    await step('expenses readable (admin)', () => listExpenses(c, { page: 0 }))
    await step('expense summary (admin)', () => expenseSummary(c, {}))
    await step('audit logs readable (admin)', () => listAudit(c, { page: 0 }))
  } else {
    // For Staff, RLS returns NO rows (the table grants SELECT but the policy is admin-only).
    for (const [name, q] of [
      ['ledger', () => c.from('customer_ledger').select('id').limit(5)],
      ['expenses', () => c.from('expenses').select('id').limit(5)],
      ['audit logs', () => c.from('audit_logs').select('id').limit(5)],
    ] as const) {
      await step(`staff sees NO ${name} rows`, async () => {
        const r = await q()
        if (r.error) return // an error is also a block
        need((r.data ?? []).length === 0, `${name}: staff received ${r.data?.length} rows`)
      })
    }
    await mustReject('staff cannot insert an expense', async () => {
      const r = await c.from('expenses').insert({ expense_number: `TEST-X-${Date.now()}`, category: 'other', amount: 1 })
      if (r.error) throw new Error(r.error.message)
    })
    await mustReject('staff cannot post a ledger adjustment', async () => {
      const r = await c.rpc('record_ledger_adjustment', { p_customer_id: custs?.rows[0]?.id ?? '00000000-0000-0000-0000-000000000000', p_transaction_type: 'adjustment', p_debit: 1, p_credit: null, p_description: 'x' })
      if (r.error) throw new Error(r.error.message)
    })
  }
  await mustReject('cannot write bill totals directly', async () => {
    const r = await c.from('bills').update({ grand_total: 1 }).eq('id', bills?.rows[0]?.id ?? '00000000-0000-0000-0000-000000000000')
    if (r.error) throw new Error(r.error.message)
  })

  /* ----------------------------------------------------------------- writes */
  if (!WRITE) {
    console.log('\nWrite tests skipped (set SMOKE_WRITE=1 to run them).')
    return
  }
  console.log('\n== Writes (TEST records only) ==')
  const stamp = Date.now()
  const customer = await step('create test customer', () =>
    createCustomer(c, {
      customer_name: `ZZ TEST CUSTOMER ${stamp} (safe to ignore)`, company_name: null, phone: null, alternate_phone: null, email: null,
      billing_address: null, shipping_address: null, city: null, state: null, pincode: null, gstin: null, notes: 'Created by scripts/smoke-kmg.ts', status: 'active',
    }),
  )
  if (!customer) return

  const input = (n: string): BillInput => ({
    bill_type: 'normal', bill_number: n, bill_number_source: 'manual', customer_id: customer.id, bill_date: todayIST(),
    party_name: null, party_address: null, party_gstin: null, eway_bill_number: null, vehicle_number: null, vehicle_id: null,
    cgst_percent: 2.5, sgst_percent: 2.5, igst_percent: null, discount_amount: null, other_charges: null, notes: 'smoke test',
    items: [
      { description: 'TEST priced line', hsn_code: null, quantity: 3, unit: null, rate: 100 },
      { description: 'TEST descriptive line', hsn_code: null, quantity: null, unit: null, rate: null },
    ],
  })

  // Bill A: create -> verify DB arithmetic + NULLs -> edit -> post -> locked -> cancel.
  const a = await step('create draft bill A with a priced and a descriptive line', () => createBill(c, input(`TEST-A-${stamp}`)))
  if (!a) return
  await step('database derived totals: 300 + CGST 7.5 + SGST 7.5 = 315, IGST NULL', async () => {
    const d = await getBill(c, a.id)
    need(Number(d.bill.subtotal) === 300, `subtotal ${d.bill.subtotal}`)
    need(Number(d.bill.cgst_amount) === 7.5 && Number(d.bill.sgst_amount) === 7.5, `tax ${d.bill.cgst_amount}/${d.bill.sgst_amount}`)
    need(d.bill.igst_amount === null && d.bill.igst_percent === null, 'IGST should stay NULL')
    need(Number(d.bill.grand_total) === 315, `grand_total ${d.bill.grand_total}`)
    const line = d.items.find((i) => i.description === 'TEST descriptive line')
    need(line && line.quantity === null && line.rate === null && line.amount === null && line.unit === null, 'descriptive line values must stay NULL')
  })
  await step('edit the draft (discount 15 -> taxable 285, tax 7.13 + 7.13 -> total 299.26)', async () => {
    await updateBill(c, a.id, { ...input(`TEST-A-${stamp}`), discount_amount: 15 })
    const d = await getBill(c, a.id)
    need(Number(d.bill.subtotal) === 300 && Number(d.bill.grand_total) === 299.26, `grand_total ${d.bill.grand_total}`)
  })
  await step('post bill A to the ledger', () => postBill(c, a.id))
  await step('posted bill is marked posted', async () => {
    const d = await getBill(c, a.id)
    need(d.bill.ledger_posted_at, 'ledger_posted_at not set')
  })
  await mustReject('posted bill A cannot be edited', () => updateBill(c, a.id, { ...input(`TEST-A-${stamp}`), discount_amount: 1 }), /posted|read-only/i)
  await mustReject('posted bill A cannot be posted twice', () => postBill(c, a.id), /already posted/i)
  if (admin) {
    await step('admin cancels bill A (reverses its ledger debit)', () => cancelBill(c, a.id, 'smoke test cleanup'))
    await step('cancelled bill A is traceable and read-only', async () => {
      const d = await getBill(c, a.id)
      need(d.bill.status === 'cancelled' && d.bill.cancellation_reason === 'smoke test cleanup', 'cancellation not recorded')
      need(Number(d.bill.balance_due) === 0, 'cancelled bill should owe 0')
    })
    await mustReject('cancelled bill A cannot be edited', () => updateBill(c, a.id, input(`TEST-A-${stamp}`)), /read-only|cancelled/i)
  } else {
    await mustReject('staff cannot cancel a bill', () => cancelBill(c, a.id, 'x'), /admin/i)
    skipped('cancel bill A', 'staff login — test bill A stays posted (ask an admin to cancel it)')
  }

  // Bill B: create -> post -> pay in full (+ idempotent retry).
  const b = await step('create draft bill B', () => createBill(c, input(`TEST-B-${stamp}`)))
  if (b) {
    await step('post bill B', () => postBill(c, b.id))
    const key = `smoke-${stamp}`
    const pay = await step('record a payment against posted bill B (full balance)', async () => {
      const d = await getBill(c, b.id)
      return recordPayment(c, { customerId: null, billId: b.id, amount: Number(d.bill.balance_due), mode: 'cash', reference: 'smoke test', notes: null, date: todayIST(), idempotencyKey: key })
    })
    if (pay) {
      await step('retrying the same payment key returns the SAME payment (no duplicate)', async () => {
        const again = await recordPayment(c, { customerId: null, billId: b.id, amount: Number(pay.amount), mode: 'cash', reference: 'smoke test', notes: null, date: todayIST(), idempotencyKey: key })
        need(again.id === pay.id, 'a second payment was created')
      })
      await step('bill B is paid, balance 0', async () => {
        const d = await getBill(c, b.id)
        need(d.bill.payment_status === 'paid' && Number(d.bill.balance_due) === 0, `${d.bill.payment_status} / ${d.bill.balance_due}`)
        need(d.payments.length === 1, `${d.payments.length} payments recorded (expected 1)`)
      })
      await mustReject('a payment above the balance is rejected', () =>
        recordPayment(c, { customerId: null, billId: b.id, amount: 1, mode: 'cash', reference: null, notes: null, date: todayIST(), idempotencyKey: `smoke-over-${stamp}` }),
      /exceeds|cannot receive|balance/i)
      await mustReject('payments cannot be deleted', async () => {
        const r = await c.from('payments').delete().eq('id', pay.id).select()
        if (r.error) throw new Error(r.error.message)
        if ((r.data ?? []).length === 0) throw new Error('0 rows deleted (blocked)')
      })
    }
  }
  if (admin) {
    await step('test customer ledger nets to zero (2 debits, 1 reversal, 1 payment)', async () => {
      const bal = await ledgerBalance(c, customer.id)
      const rows = await listLedger(c, { customerId: customer.id, page: 0 })
      need(bal === 0, `balance ${bal}`)
      need(rows.total === 4, `${rows.total} ledger rows (expected 4)`)
    })
  }

  // Quotation with a MANUAL number (does not consume a generated number).
  await step('create a quotation (manual test number) with a priced and a descriptive line', async () => {
    const items = [
      { description: 'TEST priced line', hsn_code: null, quantity: 2, unit: null, rate: 50 },
      { description: 'TEST descriptive line', hsn_code: null, quantity: null, unit: null, rate: null },
    ]
    const q = await createQuotation(c, {
      quotation_number: `TEST-Q-${stamp}`, customer_id: customer.id, quotation_date: todayIST(), valid_until: null, status: 'draft',
      discount_amount: 0, tax_amount: 0, other_charges: 0, notes: 'smoke test', terms: null, items,
    })
    const d = await getQuotation(c, q.id)
    need(Number(d.quotation.grand_total) === quotationTotals({ items, discount_amount: 0, tax_amount: 0, other_charges: 0 }).grand_total && Number(d.quotation.grand_total) === 100, `total ${d.quotation.grand_total}`)
    const line = d.items.find((i) => i.description === 'TEST descriptive line')
    need(line && line.quantity === null && line.amount === null, 'descriptive quotation line must stay NULL')
  })

  // Stock: only with an item the team marked as a test item.
  const stock = await listStock(c, {})
  const testItem = stock.find((s) => (s.materials?.name ?? '').toUpperCase().startsWith('TEST'))
  if (testItem) {
    await step('stock movement on the TEST stock item (+5 receipt, then -5 consumption)', async () => {
      await applyMovement(c, { stockItemId: testItem.stock_item_id, type: 'receipt', change: 5, reason: 'smoke test' })
      await applyMovement(c, { stockItemId: testItem.stock_item_id, type: 'consumption', change: -5, reason: 'smoke test' })
    })
    await mustReject('stock cannot go negative', () => applyMovement(c, { stockItemId: testItem.stock_item_id, type: 'consumption', change: -1e9, reason: 'smoke test' }), /insufficient/i)
  } else {
    skipped('stock movement', 'no stock item whose material name starts with "TEST" exists (no production stock is touched)')
  }
  await mustReject('cannot write stock quantity directly', async () => {
    const id = stock[0]?.stock_item_id
    if (!id) throw new Error('no stock item to attempt (treated as blocked)')
    const r = await c.from('stock_items').update({ quantity_on_hand: 999 }).eq('id', id)
    if (r.error) throw new Error(r.error.message)
  })
}

main()
  .catch((e) => {
    fail++
    failures.push(`fatal: ${e instanceof Error ? e.message : String(e)}`)
    console.log(`\nFATAL: ${e instanceof Error ? e.message : String(e)}`)
  })
  .finally(() => {
    console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`)
    if (failures.length) console.log('\nFailures:\n - ' + failures.join('\n - '))
    process.exit(fail ? 1 : 0)
  })
