/**
 * End-to-end smoke test of the REAL frontend service layer against the deployed
 * KMG Supabase project, using only the public URL + anon key and normal user
 * logins. It cannot bypass RLS and never uses a service-role key.
 *
 *   PowerShell (type the passwords yourself; they are never printed):
 *     $env:TEST_EMAIL  = 'admin@example.com'    # KMG admin login
 *     $env:TEST_PASSWORD = …
 *     $env:STAFF_EMAIL = 'staff@example.com'    # KMG staff login (optional)
 *     $env:STAFF_PASSWORD = …
 *     npm run smoke:kmg                          # reads + security checks only
 *     $env:SMOKE_WRITE = '1'; npm run smoke:kmg  # + writes with clearly marked TEST records
 *
 * Write mode NEVER touches existing rows. It creates "TEST …" records only.
 * Cleaned up afterwards where the rules allow (draft EV bill, quotation and
 * measurement sheet are deleted). Posted/paid/cancelled bills, the payment, the
 * ledger rows, the TEST customer and the TEST stock item/material cannot be
 * deleted by design (financial and audit history); the customer's ledger nets to
 * zero. One payment number is consumed.
 */
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cancelBill, createBill, deleteDraftBill, getBill, listBills, postBill, updateBill, type BillInput } from '@/services/bills'
import { createCustomer, createMaterial, listAudit, listCustomers } from '@/services/catalog'
import { createQuotation, createSheet, getQuotation, getSheet, listQuotations, listSheets, quotationTotals } from '@/services/documents'
import { expenseSummary, ledgerBalance, listExpenses, listLedger, listPayments, recordPayment } from '@/services/finance'
import { loadKpis, recentActivity } from '@/services/dashboard'
import { applyMovement, createStockItem, listDrivers, listStock, listTrips, listVehicles } from '@/services/operations'
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
const ADMIN = { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }
const STAFF = { email: process.env.STAFF_EMAIL, password: process.env.STAFF_PASSWORD }
const WRITE = process.env.SMOKE_WRITE === '1'
const NIL = '00000000-0000-0000-0000-000000000000'

let pass = 0
let fail = 0
let skip = 0
const failures: string[] = []
const say = (tag: string, name: string, extra = '') => console.log(`  ${tag.padEnd(5)} ${name}${extra ? `\n         ${extra}` : ''}`)
const errMsg = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e))
async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const r = await fn()
    pass++
    say('ok', name)
    return r
  } catch (e) {
    fail++
    failures.push(`${name}: ${errMsg(e)}`)
    say('FAIL', name, errMsg(e))
    return undefined
  }
}
/** The operation MUST be rejected by the database (an error, or zero rows changed). */
async function mustReject(name: string, fn: () => Promise<unknown>, re?: RegExp) {
  try {
    await fn()
    fail++
    failures.push(`${name}: succeeded but should have been rejected`)
    say('FAIL', name, 'succeeded but should have been rejected')
  } catch (e) {
    const msg = errMsg(e)
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
/** Turn a supabase-js result into a throw, so mustReject can assert on it. */
const raise = (r: { error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message)
}

interface Me {
  role: 'admin' | 'staff'
  status: string
  full_name: string
}
const mk = () => createClient(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

async function login(label: string, creds: { email?: string; password?: string }): Promise<{ c: SupabaseClient; me: Me } | undefined> {
  console.log(`\n== ${label}: authentication & business context ==`)
  const c = mk()
  const ok = await step(`${label}: sign in`, async () => {
    const r = await c.auth.signInWithPassword({ email: creds.email!, password: creds.password! })
    raise(r)
    return true
  })
  if (!ok) return undefined
  const me = await step(`${label}: staff_profiles resolves (KMG database only)`, async () => {
    const { data: u } = await c.auth.getUser()
    const r = await c.from('staff_profiles').select('role,status,full_name').eq('user_id', u.user!.id).maybeSingle()
    raise(r)
    need(r.data, 'No staff_profiles row visible for this user (missing, or inactive).')
    return r.data as Me
  })
  if (!me) return undefined
  await step(`${label}: status is active`, async () => need(me.status === 'active', `status=${me.status}`))
  console.log(`  ${label} role: ${me.role}`)
  return { c, me }
}

interface Shared {
  customerId?: string
  billPosted?: string // posted + paid
  billCancelled?: string
  paymentId?: string
  stockItemId?: string
}

async function main() {
  need(URL && KEY, 'Missing VITE_KMG_SUPABASE_URL / VITE_KMG_SUPABASE_ANON_KEY (.env.local).')
  console.log(`\nKMG project: ${new globalThis.URL(URL!).host}`)

  /* ------------------------------------------------------------ unauthorised */
  console.log('\n== Anonymous (anon key, no login) ==')
  const anon = mk()
  for (const t of ['staff_profiles', 'customers', 'bills', 'customer_ledger', 'expenses', 'audit_logs', 'stock_items', 'payments', 'measurement_sheets']) {
    await mustReject(`anon cannot read ${t}`, async () => {
      const r = await anon.from(t).select('*').limit(1)
      raise(r)
      if ((r.data ?? []).length > 0) return // a leak
      throw new Error('empty result without error — treated as blocked')
    })
  }
  for (const fn of ['record_payment', 'post_bill_to_ledger', 'cancel_bill', 'apply_stock_movement', 'next_document_number', 'record_ledger_adjustment']) {
    await mustReject(`anon cannot execute ${fn}`, async () => raise(await anon.rpc(fn, {})))
  }

  const shared: Shared = {}

  /* ------------------------------------------------------------------- admin */
  if (ADMIN.email && ADMIN.password) {
    const a = await login('ADMIN', ADMIN)
    if (a) {
      await adminPhase(a.c, a.me, shared)
    }
  } else {
    skipped('ADMIN phase', 'TEST_EMAIL / TEST_PASSWORD not set')
  }

  /* ------------------------------------------------------------------- staff */
  if (STAFF.email && STAFF.password) {
    const s = await login('STAFF', STAFF)
    if (s) await staffPhase(s.c, s.me, shared)
  } else {
    skipped('STAFF phase', 'STAFF_EMAIL / STAFF_PASSWORD not set')
  }
}

/* ============================================================== ADMIN PHASE */
async function adminPhase(c: SupabaseClient, me: Me, shared: Shared) {
  await step('ADMIN: role is admin', async () => need(me.role === 'admin', `role=${me.role} (TEST_EMAIL must be an admin)`))
  const admin = me.role === 'admin'

  console.log('\n== ADMIN reads ==')
  await step('dashboard KPIs', () => loadKpis(c, todayIST()))
  await step('dashboard recent activity (bills, quotations, payments, trips)', () => recentActivity(c))
  const bills = await step('bills list', () => listBills(c, { page: 0 }))
  await step('EV bills list', () => listBills(c, { page: 0, type: 'ev' }))
  await step('Normal bills list', () => listBills(c, { page: 0, type: 'normal' }))
  await step('quotations list', () => listQuotations(c, { page: 0 }))
  await step('measurement sheets list', () => listSheets(c, { page: 0 }))
  const custs = await step('customers list', () => listCustomers(c, { page: 0 }))
  await step('payments list (read)', () => listPayments(c, { page: 0 }))
  await step('stock list (movement-based view)', () => listStock(c, {}))
  await step('vehicles', () => listVehicles(c))
  await step('drivers', () => listDrivers(c))
  await step('trips', () => listTrips(c, { page: 0 }))
  console.log(`  (existing bills: ${bills?.total ?? '?'}, customers: ${custs?.total ?? '?'})`)

  if (admin) {
    console.log('\n== ADMIN-only reads ==')
    const first = custs?.rows[0]?.id
    await step('customer ledger readable', async () => (first ? listLedger(c, { customerId: first, page: 0 }) : []))
    await step('expenses readable', () => listExpenses(c, { page: 0 }))
    await step('expense summary readable', () => expenseSummary(c, {}))
    await step('audit logs readable', () => listAudit(c, { page: 0 }))
  }
  await mustReject('bill totals cannot be written directly', async () => {
    raise(await c.from('bills').update({ grand_total: 1 }).eq('id', bills?.rows[0]?.id ?? NIL))
  })

  if (!WRITE) {
    console.log('\nADMIN write tests skipped (set SMOKE_WRITE=1).')
    return
  }

  console.log('\n== ADMIN writes (TEST records only) ==')
  const stamp = Date.now()
  const customer = await step('create TEST customer', () =>
    createCustomer(c, {
      customer_name: `ZZ TEST CUSTOMER ${stamp} (safe to ignore)`, company_name: null, phone: null, alternate_phone: null, email: null,
      billing_address: null, shipping_address: null, city: null, state: null, pincode: null, gstin: null, notes: 'Created by scripts/smoke-kmg.ts', status: 'active',
    }),
  )
  if (!customer) return
  shared.customerId = customer.id

  // ---- quotation (manual TEST number so no generated number is consumed)
  const qItems = [
    { description: 'TEST priced line', hsn_code: null, quantity: 2, unit: null, rate: 50 },
    { description: 'TEST descriptive line', hsn_code: null, quantity: null, unit: null, rate: null },
  ]
  const quotation = await step('create TEST quotation (priced + descriptive line)', () =>
    createQuotation(c, {
      quotation_number: `TEST-Q-${stamp}`, customer_id: customer.id, quotation_date: todayIST(), valid_until: null, status: 'draft',
      discount_amount: 10, tax_amount: 5, other_charges: 0, notes: 'smoke test', terms: null, items: qItems,
    }),
  )
  if (quotation) {
    await step('quotation: subtotal 100, discount 10, tax 5 -> total 95; descriptive line NULL', async () => {
      const d = await getQuotation(c, quotation.id)
      const t = quotationTotals({ items: qItems, discount_amount: 10, tax_amount: 5, other_charges: 0 })
      need(Number(d.quotation.subtotal) === 100 && t.grand_total === 95 && Number(d.quotation.grand_total) === 95, `subtotal ${d.quotation.subtotal}, total ${d.quotation.grand_total}`)
      const line = d.items.find((i) => i.description === 'TEST descriptive line')
      need(line && line.quantity === null && line.rate === null && line.amount === null, 'descriptive line must stay NULL')
    })
    await step('cleanup: delete TEST quotation', async () => raise(await c.from('quotations').delete().eq('id', quotation.id)))
  }

  // ---- bills
  const input = (n: string, type: 'normal' | 'ev' = 'normal'): BillInput => ({
    bill_type: type, bill_number: n, bill_number_source: 'manual', customer_id: customer.id, bill_date: todayIST(),
    party_name: null, party_address: null, party_gstin: null, eway_bill_number: null, vehicle_number: null, vehicle_id: null,
    cgst_percent: 2.5, sgst_percent: 2.5, igst_percent: null, discount_amount: null, other_charges: null, notes: 'smoke test',
    items: [
      { description: 'TEST priced line', hsn_code: null, quantity: 3, unit: null, rate: 100 },
      { description: 'TEST descriptive line', hsn_code: null, quantity: null, unit: null, rate: null },
    ],
  })
  const numA = `TEST-A-${stamp}`
  const a = await step('create draft Normal bill A with a MANUAL existing-style number', () => createBill(c, input(numA)))
  if (!a) return
  await step('line amount = quantity x rate; totals 300 + CGST 7.5 + SGST 7.5 = 315; IGST NULL; descriptive line NULL', async () => {
    const d = await getBill(c, a.id)
    need(d.bill.bill_number === numA && d.bill.bill_number_source === 'manual', 'manual number not preserved')
    const priced = d.items.find((i) => i.description === 'TEST priced line')
    need(priced && Number(priced.amount) === Number(priced.quantity) * Number(priced.rate), 'line amount != quantity x rate')
    need(Number(d.bill.subtotal) === 300 && Number(d.bill.cgst_amount) === 7.5 && Number(d.bill.sgst_amount) === 7.5 && Number(d.bill.grand_total) === 315, `${d.bill.subtotal}/${d.bill.cgst_amount}/${d.bill.sgst_amount}/${d.bill.grand_total}`)
    need(d.bill.igst_amount === null && d.bill.igst_percent === null, 'IGST should stay NULL')
    const line = d.items.find((i) => i.description === 'TEST descriptive line')
    need(line && line.quantity === null && line.rate === null && line.amount === null && line.unit === null, 'descriptive line must stay NULL')
  })
  await step('edit the draft (discount 15 -> taxable 285, tax 7.13 + 7.13 -> total 299.26)', async () => {
    await updateBill(c, a.id, { ...input(numA), discount_amount: 15 })
    const d = await getBill(c, a.id)
    need(Number(d.bill.grand_total) === 299.26, `grand_total ${d.bill.grand_total}`)
  })
  await step('EV bill with the SAME number stays a distinct document', async () => {
    const ev = await createBill(c, input(numA, 'ev'))
    const both = await listBills(c, { page: 0, q: numA })
    need(both.rows.length === 2 && new Set(both.rows.map((r) => r.bill_type)).size === 2, `${both.rows.length} rows for that number`)
    await deleteDraftBill(c, ev.id) // cleanup (an unposted draft may be deleted by an admin)
  })
  await step('post bill A to the ledger', () => postBill(c, a.id))
  await mustReject('posted bill A cannot be edited', () => updateBill(c, a.id, { ...input(numA), discount_amount: 1 }), /posted|read-only/i)
  await mustReject('posted bill A cannot have a line added', async () => raise(await c.from('bill_items').insert({ bill_id: a.id, description: 'late', quantity: 1, rate: 1, amount: 1 })), /posted|read-only/i)
  await mustReject('posted bill A cannot be posted twice', () => postBill(c, a.id), /already posted/i)
  await step('posted bill A keeps its number and posting timestamp (traceable)', async () => {
    const d = await getBill(c, a.id)
    need(d.bill.bill_number === numA && d.bill.ledger_posted_at, 'number/posting lost')
  })
  await step('admin cancels posted bill A (no payments)', () => cancelBill(c, a.id, 'smoke test cleanup'))
  await step('cancelled bill A stays traceable (number, reason, who/when) and balance_due = 0', async () => {
    const d = await getBill(c, a.id)
    need(d.bill.status === 'cancelled' && d.bill.bill_number === numA && d.bill.cancellation_reason === 'smoke test cleanup' && d.bill.cancelled_at && d.bill.cancelled_by, 'cancellation not fully recorded')
    need(Number(d.bill.balance_due) === 0, `balance_due ${d.bill.balance_due}`)
  })
  await mustReject('cancelled bill A is read-only', () => updateBill(c, a.id, input(numA)), /read-only|cancelled/i)
  await mustReject('cancelled bill A cannot be cancelled again', () => cancelBill(c, a.id, 'again'), /already/i)
  shared.billCancelled = a.id

  // ---- bill B: post, pay, idempotency, overpay, delete
  const b = await step('create draft bill B', () => createBill(c, input(`TEST-B-${stamp}`)))
  if (b) {
    await step('post bill B', () => postBill(c, b.id))
    shared.billPosted = b.id
    const key = `smoke-${stamp}`
    const balance = await step('read bill B balance_due', async () => Number((await getBill(c, b.id)).bill.balance_due))
    const pay = await step('record TEST payment via record_payment() for the full balance', async () =>
      recordPayment(c, { customerId: null, billId: b.id, amount: balance!, mode: 'cash', reference: 'smoke test', notes: null, date: todayIST(), idempotencyKey: key }),
    )
    if (pay) {
      shared.paymentId = pay.id
      await step('same idempotency key again -> SAME payment id, no duplicate', async () => {
        const again = await recordPayment(c, { customerId: null, billId: b.id, amount: balance!, mode: 'cash', reference: 'smoke test', notes: null, date: todayIST(), idempotencyKey: key })
        need(again.id === pay.id, 'a second payment was created')
        need((await getBill(c, b.id)).payments.length === 1, 'more than one payment row exists')
      })
      await step('bill B is paid, balance_due 0', async () => {
        const d = await getBill(c, b.id)
        need(d.bill.payment_status === 'paid' && Number(d.bill.balance_due) === 0, `${d.bill.payment_status}/${d.bill.balance_due}`)
      })
      await mustReject('overpayment is rejected', () =>
        recordPayment(c, { customerId: null, billId: b.id, amount: 1, mode: 'cash', reference: null, notes: null, date: todayIST(), idempotencyKey: `smoke-over-${stamp}` }),
      /exceeds|balance/i)
      await mustReject('payment deletion is rejected', async () => {
        const r = await c.from('payments').delete().eq('id', pay.id).select()
        raise(r)
        if ((r.data ?? []).length === 0) throw new Error('0 rows deleted (blocked)')
      })
      await mustReject('payment editing is rejected', async () => raise(await c.from('payments').update({ amount: 1 }).eq('id', pay.id)))
    }
  }
  await step('customer ledger nets to zero: 4 entries (2 debits, 1 reversal, 1 payment)', async () => {
    const bal = await ledgerBalance(c, customer.id)
    const rows = await listLedger(c, { customerId: customer.id, page: 0 })
    need(bal === 0 && rows.total === 4, `balance ${bal}, rows ${rows.total}`)
    const debit = rows.rows.reduce((s, r) => s + Number(r.debit), 0)
    const credit = rows.rows.reduce((s, r) => s + Number(r.credit), 0)
    need(Math.abs(debit - 299.26 - 315) < 0.005 && Math.abs(credit - 299.26 - 315) < 0.005, `debit ${debit}, credit ${credit}`)
  })

  // ---- measurement sheet: stored exactly as typed
  const SHEET = [
    ['54 × 24 × 09', 'M', 108, 520, 56160], ['52 × 18 × 9.5"', 'M', 78, 520, 40560], ['52 × 18 × 9.5"', 'M', 78, 520, 40560],
    ['51 × 18 × 9.5"', 'M', 76.5, 520, 39780], ['45 × 18 × 12"', 'M', 67.5, 550, 37125], ['7 × 36 × 08', '①M', 21, 460, 9660],
    ['7.5 × 12 × 7.25"', '3M', 22.5, 400, 9000], ['3.5 × 15 × 08"', '1M', 4, 460, 1840],
  ] as const
  const sheet = await step('create TEST measurement sheet (8 rows, values typed exactly)', () =>
    createSheet(c, {
      sheet_number: `TEST-MS-${stamp}`, sheet_date: null, customer_id: null, party_name_text: 'TEST (safe to ignore)', stated_total: 234685, notes: 'smoke test',
      rows: SHEET.map(([m, p, q, r, amt]) => ({ measurement_text: m, pcs_text: p, quantity: q, rate: r, amount: amt })),
    }),
  )
  if (sheet) {
    await step('measurement rows read back EXACTLY; no unit/formula invented; total 234685 = row sum', async () => {
      const d = await getSheet(c, sheet.id)
      need(d.rows.length === 8, `${d.rows.length} rows`)
      d.rows.forEach((row, i) => {
        const [m, p, q, r, amt] = SHEET[i]!
        need(row.measurement_text === m && row.pcs_text === p && Number(row.quantity) === q && Number(row.rate) === r && Number(row.amount) === amt, `row ${i + 1} differs: ${JSON.stringify(row)}`)
      })
      need(d.sheet.sheet_date === null && d.sheet.customer_id === null, 'blank header fields must stay NULL')
      need(Number(d.verification?.rows_amount_sum) === 234685 && Number(d.verification?.difference) === 0 && d.verification?.rows_where_amount_differs_from_qty_x_rate === 0, JSON.stringify(d.verification))
    })
    await step('cleanup: delete TEST measurement sheet', async () => raise(await c.from('measurement_sheets').delete().eq('id', sheet.id)))
  }

  // ---- stock: a TEST material + TEST stock item, moved only via apply_stock_movement()
  const matName = `TEST MATERIAL ${stamp}`
  const sid = await step('create TEST material and TEST stock item (starts at 0)', async () => {
    await createMaterial(c, { name: matName, category: 'other', hsn_code: null, default_unit: null, default_rate: null, low_stock_threshold: null })
    const m = await c.from('materials').select('id').eq('name', matName).single()
    raise(m)
    await createStockItem(c, { material_id: (m.data as { id: string }).id, batch_code: `TEST-${stamp}`, location: null, unit: null })
    const item = (await listStock(c, {})).find((s) => s.materials?.name === matName)
    need(item && Number(item.current_quantity) === 0, 'stock item not found or not at 0')
    return item!.stock_item_id
  })
  if (sid) {
    shared.stockItemId = sid
    await step('movements via apply_stock_movement: +50 receipt, -20 sale, -5 damage, +2 adjustment => current 27', async () => {
      await applyMovement(c, { stockItemId: sid, type: 'receipt', change: 50, reason: 'smoke test' })
      await applyMovement(c, { stockItemId: sid, type: 'sale', change: -20, reason: 'smoke test' })
      await applyMovement(c, { stockItemId: sid, type: 'damage', change: -5, reason: 'smoke test' })
      await applyMovement(c, { stockItemId: sid, type: 'adjustment', change: 2, reason: 'smoke test' })
      const it = (await listStock(c, {})).find((s) => s.stock_item_id === sid)!
      need(Number(it.received_quantity) === 50 && Number(it.used_quantity) === 25 && Number(it.adjustment_quantity) === 2 && Number(it.current_quantity) === 27 && Number(it.quantity_on_hand) === 27, JSON.stringify(it))
    })
    await mustReject('negative stock is rejected', () => applyMovement(c, { stockItemId: sid, type: 'sale', change: -1000, reason: 'smoke test' }), /insufficient/i)
    await mustReject('stock quantity cannot be written directly', async () => raise(await c.from('stock_items').update({ quantity_on_hand: 999 }).eq('id', sid)))
    await mustReject('stock movements cannot be inserted directly', async () =>
      raise(await c.from('stock_movements').insert({ stock_item_id: sid, movement_type: 'receipt', quantity_change: 5, previous_quantity: 27, new_quantity: 32 })),
    )
  }
  await step('bills never created a stock movement (TEST stock item history has only the 4 explicit movements)', async () => {
    const r = await c.from('stock_movements').select('id', { count: 'exact', head: true }).eq('stock_item_id', sid ?? NIL)
    raise(r)
    need((r.count ?? 0) === 4, `${r.count} movements`)
  })
}

/* ============================================================== STAFF PHASE */
async function staffPhase(c: SupabaseClient, me: Me, shared: Shared) {
  await step('STAFF: role is staff (STAFF_EMAIL must not be an admin)', async () => need(me.role === 'staff', `role=${me.role}`))

  console.log('\n== STAFF: modules currently allowed (current application behaviour) ==')
  await step('dashboard KPIs', () => loadKpis(c, todayIST()))
  await step('bills list', () => listBills(c, { page: 0 }))
  await step('quotations list', () => listQuotations(c, { page: 0 }))
  await step('measurement sheets list', () => listSheets(c, { page: 0 }))
  const custs = await step('customers list (currently ALLOWED for staff — product decision pending)', () => listCustomers(c, { page: 0 }))
  await step('payments list (currently ALLOWED for staff — product decision pending)', () => listPayments(c, { page: 0 }))
  await step('stock list', () => listStock(c, {}))
  await step('vehicles / drivers / trips', async () => {
    await listVehicles(c)
    await listDrivers(c)
    await listTrips(c, { page: 0 })
  })

  console.log('\n== STAFF: admin-only data is invisible ==')
  for (const [name, q] of [
    ['customer_ledger', () => c.from('customer_ledger').select('id').limit(5)],
    ['expenses', () => c.from('expenses').select('id').limit(5)],
    ['audit_logs', () => c.from('audit_logs').select('id').limit(5)],
  ] as const) {
    await step(`staff sees NO ${name} rows`, async () => {
      const r = await q()
      if (r.error) return // an error is also a block
      need((r.data ?? []).length === 0, `${name}: staff received ${r.data?.length} rows`)
    })
  }
  if (shared.customerId) {
    await step('staff sees NO ledger rows for the TEST customer (admin sees 4)', async () => {
      const r = await c.from('customer_ledger').select('id').eq('customer_id', shared.customerId!)
      need(!r.error ? (r.data ?? []).length === 0 : true, `${r.data?.length} rows visible`)
    })
  }

  console.log('\n== STAFF: restricted writes are rejected ==')
  await mustReject('staff cannot insert an expense', async () => raise(await c.from('expenses').insert({ expense_number: `TEST-X-${Date.now()}`, category: 'other', amount: 1 })))
  await mustReject('staff cannot post a ledger adjustment', async () =>
    raise(await c.rpc('record_ledger_adjustment', { p_customer_id: custs?.rows[0]?.id ?? NIL, p_transaction_type: 'adjustment', p_debit: 1, p_credit: null, p_description: 'x' })),
  )
  await mustReject('staff cannot cancel a bill', async () => raise(await c.rpc('cancel_bill', { p_bill_id: shared.billPosted ?? NIL, p_reason: 'x' })), /admin/i)
  await mustReject('staff cannot write bill totals or amount_received', async () => raise(await c.from('bills').update({ grand_total: 1, amount_received: 1 }).eq('id', shared.billPosted ?? NIL)))
  await mustReject('staff cannot insert a payment directly (must use record_payment)', async () =>
    raise(await c.from('payments').insert({ payment_number: `TEST-X-${Date.now()}`, customer_id: shared.customerId ?? NIL, amount: 1, payment_mode: 'cash' })),
  )
  await mustReject('staff cannot write ledger rows directly', async () =>
    raise(await c.from('customer_ledger').insert({ customer_id: shared.customerId ?? NIL, transaction_type: 'adjustment', debit: 1, running_balance: 1 })),
  )
  await mustReject('staff cannot write stock quantity directly', async () => raise(await c.from('stock_items').update({ quantity_on_hand: 999 }).eq('id', shared.stockItemId ?? NIL)))
  await mustReject('staff cannot insert stock movements directly', async () =>
    raise(await c.from('stock_movements').insert({ stock_item_id: shared.stockItemId ?? NIL, movement_type: 'receipt', quantity_change: 1, previous_quantity: 0, new_quantity: 1 })),
  )
  await mustReject('staff cannot write audit logs', async () => raise(await c.from('audit_logs').insert({ action: 'INSERT', module: 'x' })))

  if (shared.billPosted) {
    await mustReject('staff cannot modify the POSTED test bill', async () => {
      const d = await getBill(c, shared.billPosted!)
      await updateBill(c, shared.billPosted!, {
        bill_type: d.bill.bill_type, bill_number: d.bill.bill_number, bill_number_source: d.bill.bill_number_source, customer_id: d.bill.customer_id, bill_date: d.bill.bill_date,
        party_name: null, party_address: null, party_gstin: null, eway_bill_number: null, vehicle_number: null, vehicle_id: null, cgst_percent: 2.5, sgst_percent: 2.5,
        igst_percent: null, discount_amount: 1, other_charges: null, notes: null, items: [{ description: 'x', hsn_code: null, quantity: 1, unit: null, rate: 1 }],
      })
    }, /posted|read-only/i)
  } else skipped('staff vs posted bill', 'no TEST posted bill (run the ADMIN write phase first in the same run)')
  if (shared.billCancelled) {
    await mustReject('staff cannot modify the CANCELLED test bill', async () => raise(await c.from('bills').update({ notes: 'x' }).eq('id', shared.billCancelled!)), /read-only|cancelled/i)
  } else skipped('staff vs cancelled bill', 'no TEST cancelled bill')
  if (shared.paymentId) {
    await mustReject('staff cannot delete a payment', async () => {
      const r = await c.from('payments').delete().eq('id', shared.paymentId!).select()
      raise(r)
      if ((r.data ?? []).length === 0) throw new Error('0 rows deleted (blocked)')
    })
  } else skipped('staff vs payment deletion', 'no TEST payment')
  if (shared.stockItemId) {
    await mustReject('staff cannot take stock below zero via apply_stock_movement', () => applyMovement(c, { stockItemId: shared.stockItemId!, type: 'sale', change: -1e6, reason: 'smoke' }), /insufficient/i)
  } else skipped('staff vs stock rules', 'no TEST stock item')
}

main()
  .catch((e) => {
    fail++
    failures.push(`fatal: ${errMsg(e)}`)
    console.log(`\nFATAL: ${errMsg(e)}`)
  })
  .finally(() => {
    console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`)
    if (failures.length) console.log('\nFailures:\n - ' + failures.join('\n - '))
    process.exit(fail ? 1 : 0)
  })
