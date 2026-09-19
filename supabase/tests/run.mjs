// Applies the real migrations to real PostgreSQL (PGlite, PG 18) and verifies
// schema, constraints, calculations, ledger/stock behaviour, RLS and grants.
//
// It emulates the parts of Supabase the migrations depend on: the `anon` /
// `authenticated` roles, `auth.users`, `auth.uid()`, and Supabase's default
// "grant ALL on new tables/functions to anon+authenticated". Migrations are
// run as a NON-superuser owner role (like Supabase's `postgres`), and every
// check runs under the same role a real API request would (`SET ROLE`).
//
//   npm run test:db
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
const sqlFiles = (dir) =>
  readdirSync(join(root, dir)).filter((f) => f.endsWith('.sql')).sort().map((f) => [f, readFileSync(join(root, dir, f), 'utf8')])

const ADMIN = '00000000-0000-0000-0000-0000000000a1'
const STAFF = '00000000-0000-0000-0000-0000000000b1'
const STAFF2_INACTIVE = '00000000-0000-0000-0000-0000000000b2'
const NOBODY = '00000000-0000-0000-0000-0000000000c1' // authenticated, no staff_profiles row

let passed = 0
const failures = []
const ok = (name) => { passed++; console.log(`  ok   ${name}`) }
const bad = (name, why) => { failures.push(`${name}: ${why}`); console.log(`  FAIL ${name}\n         ${why}`) }
const check = (name, cond, detail = '') => (cond ? ok(name) : bad(name, detail || 'condition false'))
const eq = (name, actual, expected) =>
  String(actual) === String(expected) ? ok(name) : bad(name, `expected ${expected}, got ${actual}`)

async function bootstrap(db) {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role app_owner nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, app_owner;
    grant execute on function auth.uid() to anon, authenticated, app_owner;
    grant select, references on auth.users to app_owner;
    grant all on schema public to app_owner;
    grant usage on schema public to anon, authenticated;
    -- Supabase default privileges for objects created by the migration role:
    alter default privileges for role app_owner in schema public grant all on tables to anon, authenticated;
    alter default privileges for role app_owner in schema public grant all on sequences to anon, authenticated;
    alter default privileges for role app_owner in schema public grant execute on functions to anon, authenticated;
  `)
}
async function migrate(db, dir) {
  await bootstrap(db)
  await db.exec('set role app_owner')
  for (const [name, sql] of sqlFiles(dir)) {
    try { await db.exec(sql) } catch (e) { await db.exec('reset role'); throw new Error(`${dir}/${name}: ${e.message}`) }
  }
  await db.exec('reset role')
}
const asUser = async (db, uid, role = 'authenticated') => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role}`)
}
const asOwner = (db) => db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false)`)
const rows = async (db, sql, params) => (await db.query(sql, params)).rows
const one = async (db, sql, params) => (await rows(db, sql, params))[0]
async function fails(db, name, sql, re, params) {
  try {
    await db.query(sql, params)
    bad(name, 'statement succeeded but was expected to fail')
  } catch (e) {
    re.test(e.message) ? ok(name) : bad(name, `failed with unexpected error: ${e.message}`)
  }
}

// ---------------------------------------------------------------------------
console.log('\n== Applying migrations ==')
const central = new PGlite()
const kmg = new PGlite()
const mrd = new PGlite()
await migrate(central, 'central')
ok('central migrations apply (001, 002)')
await migrate(kmg, 'business-template')
ok('KMG business-template migrations apply (001-012)')
await migrate(mrd, 'business-template')
ok('Murudeshwara business-template migrations apply (001-012)')
const db = kmg

// ---------------------------------------------------------------------------
console.log('\n== Schema structure ==')
const tables = (await rows(db, `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`)).map((r) => r.table_name)
const expectedTables = ['audit_logs','bill_items','bills','customer_ledger','customers','document_sequences','drivers','expenses','materials','measurement_sheet_rows','measurement_sheets','payments','quotation_items','quotations','settings','staff_profiles','stock_items','stock_movements','trips','units','vehicles']
eq('business database has exactly the expected 21 tables', tables.join(','), expectedTables.join(','))
const noRls = await rows(db, `select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)
eq('RLS is enabled on every table', noRls.length, 0)
eq('no business_id column anywhere in the operational schema',
  (await rows(db, `select 1 from information_schema.columns where table_schema='public' and column_name ilike '%business_id%'`)).length, 0)
const centralTables = (await rows(central, `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`)).map((r) => r.table_name)
eq('central database has only the 4 registry tables', centralTables.join(','), 'central_audit_logs,central_businesses,central_user_business_access,central_users')

const col = async (t, c) => one(db, `select data_type, is_nullable, numeric_precision p, numeric_scale s from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2`, [t, c])
for (const c of ['eway_bill_number','vehicle_number','vehicle_id','party_name','party_address','party_gstin','cgst_percent','sgst_percent','igst_percent','bill_type','bill_number','bill_number_source']) {
  check(`bills.${c} exists`, !!(await col('bills', c)))
}
for (const c of ['description','hsn_code','quantity','unit','rate','amount']) check(`bill_items.${c} exists`, !!(await col('bill_items', c)))
for (const c of ['quantity','unit','rate','amount','hsn_code']) eq(`bill_items.${c} is nullable`, (await col('bill_items', c)).is_nullable, 'YES')
for (const c of ['igst_amount','cgst_amount','sgst_amount','igst_percent']) eq(`bills.${c} is nullable (NULL != 0)`, (await col('bills', c)).is_nullable, 'YES')
for (const [t, c] of [['bills','grand_total'],['bills','subtotal'],['bill_items','amount'],['payments','amount'],['customer_ledger','running_balance'],['expenses','amount']]) {
  const r = await col(t, c); check(`${t}.${c} is numeric(14,2)`, r.data_type === 'numeric' && r.p == 14 && r.s == 2, JSON.stringify(r))
}
const floats = await rows(db, `select table_name||'.'||column_name n from information_schema.columns where table_schema='public' and data_type in ('real','double precision')`)
eq('no floating-point columns anywhere', floats.length, 0)

const fk = async (name) => (await rows(db, `select 1 from pg_constraint where conname=$1 and contype='f'`, [name])).length === 1
for (const n of ['bills_vehicle_fk','bills_trip_fk','quotations_converted_bill_fk','payments_bill_customer_fk']) check(`foreign key ${n} exists`, await fk(n))
check('unique (bill_type, bill_number) exists',
  (await rows(db, `select 1 from pg_constraint where conname='bills_number_unique_per_type' and contype='u'`)).length === 1)
eq('no global unique on bills.bill_number alone',
  (await rows(db, `select 1 from pg_constraint c where conrelid='public.bills'::regclass and contype='u' and array_length(conkey,1)=1 and conkey[1]=(select attnum from pg_attribute where attrelid=c.conrelid and attname='bill_number')`)).length, 0)
const mFk = await rows(db, `select conrelid::regclass::text t, confrelid::regclass::text r from pg_constraint where contype='f' and (conrelid::regclass::text like 'measurement%' or confrelid::regclass::text like 'measurement%')`)
check('measurement sheets have no FK to/from bills, quotations, payments, ledger or stock',
  mFk.every((x) => x.r === 'customers' || x.r === 'measurement_sheets' || x.r === 'staff_profiles'), JSON.stringify(mFk))
const suspicious = await rows(db, `select table_name||'.'||column_name n from information_schema.columns where table_schema='public' and column_name ~* 'payee|recipient|payout|preferred_payment|received_via|payment_identifier|beneficiar'`)
eq('no payee/recipient/payout/preferred-payment columns exist', suspicious.length, 0)
const fnHits = await rows(db, `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc ~* 'payee|recipient|payout|preferred_payment|received_via|payment_identifier|beneficiar|phone|mobile'`)
eq('no function/trigger references phone/mobile/payee/recipient logic', fnHits.length, 0)
eq('settings has no payment_identifiers row', (await rows(db, `select 1 from settings where key='payment_identifiers'`)).length, 0)
eq('units table ships empty (no invented unit)', (await one(db, 'select count(*)::int c from units')).c, 0)
const t0 = await one(db, `select value from settings where key='tax_defaults'`)
check('tax_defaults percentages are NULL, not invented', t0.value.cgst_percent === null && t0.value.igst_percent === null, JSON.stringify(t0.value))

// ---------------------------------------------------------------------------
console.log('\n== Identity: KMG and Murudeshwara run the identical schema ==')
const fingerprint = async (d) => (await rows(d, `
  select 'col:'||table_name||'.'||column_name||':'||data_type||':'||is_nullable f from information_schema.columns where table_schema='public'
  union all select 'con:'||conrelid::regclass||':'||conname||':'||pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace
  union all select 'idx:'||indexname from pg_indexes where schemaname='public'
  union all select 'fn:'||proname||':'||md5(prosrc) from pg_proc where pronamespace='public'::regnamespace
  union all select 'pol:'||tablename||':'||policyname||':'||coalesce(qual,'')||':'||coalesce(with_check,'') from pg_policies where schemaname='public'
  order by 1`)).map((r) => r.f).join('\n')
check('KMG and Murudeshwara schemas (columns, constraints, indexes, functions, policies) are identical', (await fingerprint(kmg)) === (await fingerprint(mrd)))
const dbNames = ['KMG','Murudeshwara']
ok(`two separate databases exist: ${dbNames.join(' / ')}`)

// ---------------------------------------------------------------------------
console.log('\n== Set-up: users and roles ==')
await asOwner(db)
await db.exec(`
  insert into auth.users (id, email) values ('${ADMIN}','admin@test'), ('${STAFF}','staff@test'), ('${STAFF2_INACTIVE}','gone@test'), ('${NOBODY}','nobody@test');
  insert into staff_profiles (user_id, full_name, role, status) values
    ('${ADMIN}','Test Admin','admin','active'),
    ('${STAFF}','Test Staff','staff','active'),
    ('${STAFF2_INACTIVE}','Inactive Staff','staff','inactive');
`)
ok('admin, staff, inactive staff and profile-less users created')

// ---------------------------------------------------------------------------
console.log('\n== Tax invoice example (invoice 52) ==')
await asUser(db, STAFF)
const cust = await one(db, `insert into customers (customer_name) values ('Test Customer A') returning id`)
const customerId = cust.id
eq('created_by is stamped from the session, not the client', (await one(db, 'select created_by from customers where id=$1', [customerId])).created_by, STAFF)

const bill = await one(db, `
  insert into bills (bill_type, bill_number, bill_number_source, customer_id, bill_date,
                     party_name, party_address, vehicle_number, cgst_percent, sgst_percent)
  values ('normal','52','manual',$1,'2026-01-25','Test party (as written)','Test address (as written)','TEST-VEHICLE-TEXT',2.5,2.5)
  returning id`, [customerId])
const billId = bill.id
await db.query(`insert into bill_items (bill_id, description, hsn_code, quantity, rate, amount, sort_order) values ($1,'Temple stone','6802',390,60,23400,1)`, [billId])
await db.query(`insert into bill_items (bill_id, description, sort_order) values ($1,'Temple cutting',2)`, [billId])
let b = await one(db, 'select * from bills where id=$1', [billId])
eq('390 x 60 = subtotal', b.subtotal, '23400.00')
eq('CGST 2.5% = 585', b.cgst_amount, '585.00')
eq('SGST 2.5% = 585', b.sgst_amount, '585.00')
eq('IGST blank stays NULL (not 0)', b.igst_amount, null)
eq('IGST percent blank stays NULL', b.igst_percent, null)
eq('tax total = 1170', b.tax_amount, '1170.00')
eq('grand total = 24,570 (23,400 + 585 + 585), computed by the database', b.grand_total, '24570.00')
eq('balance_due = grand total before any payment', b.balance_due, '24570.00')
eq('payment_status starts unpaid', b.payment_status, 'unpaid')
eq('manual number is preserved as typed', b.bill_number, '52')
eq('vehicle number is stored as written text', b.vehicle_number, 'TEST-VEHICLE-TEXT')
const cutting = await one(db, `select * from bill_items where bill_id=$1 and description='Temple cutting'`, [billId])
check('"Temple cutting" line: quantity, unit, rate, amount, hsn are all NULL (not 0)',
  cutting.quantity === null && cutting.unit === null && cutting.rate === null && cutting.amount === null && cutting.hsn_code === null, JSON.stringify(cutting))
await fails(db, 'a line whose amount != quantity x rate is rejected', `insert into bill_items (bill_id, description, quantity, rate, amount) values ($1,'x',390,60,23000)`, /bill_item_amount_consistent/, [billId])
await fails(db, 'client cannot supply grand_total on insert', `insert into bills (bill_type,bill_number,bill_number_source,customer_id,grand_total) values ('normal','G1','manual',$1,1)`, /permission denied/, [customerId])
await fails(db, 'client cannot update grand_total', `update bills set grand_total = 1 where id=$1`, /permission denied/, [billId])
await fails(db, 'client cannot update amount_received', `update bills set amount_received = 5 where id=$1`, /permission denied/, [billId])
await fails(db, 'client cannot update payment_status', `update bills set payment_status = 'paid' where id=$1`, /permission denied/, [billId])
await fails(db, 'client cannot mark a bill posted', `update bills set ledger_posted_at = now() where id=$1`, /permission denied/, [billId])
// derived values follow the inputs
await db.query(`update bills set discount_amount = 400 where id=$1`, [billId])
b = await one(db, 'select * from bills where id=$1', [billId])
eq('discount 400 -> taxable 23,000 -> CGST 575', b.cgst_amount, '575.00')
eq('discount 400 -> grand total 24,150', b.grand_total, '24150.00')
await db.query(`update bills set discount_amount = null where id=$1`, [billId])
eq('clearing the discount restores 24,570', (await one(db, 'select grand_total from bills where id=$1', [billId])).grand_total, '24570.00')
await db.query(`update bills set cgst_percent = null, sgst_percent = null, igst_percent = 5 where id=$1`, [billId])
b = await one(db, 'select * from bills where id=$1', [billId])
check('switching to IGST-only: CGST/SGST NULL, IGST = 1170, total unchanged 24,570',
  b.cgst_amount === null && b.sgst_amount === null && b.igst_amount === '1170.00' && b.grand_total === '24570.00', JSON.stringify(b))
await db.query(`update bills set cgst_percent = 2.5, sgst_percent = 2.5, igst_percent = null where id=$1`, [billId])
eq('restored to CGST+SGST -> 24,570', (await one(db, 'select grand_total from bills where id=$1', [billId])).grand_total, '24570.00')

// ---------------------------------------------------------------------------
console.log('\n== Bill numbering ==')
await db.query(`insert into bills (bill_type,bill_number,bill_number_source,customer_id) values ('ev','52','manual',$1)`, [customerId])
ok('EV / 52 coexists with Normal / 52 (unique per bill type)')
await fails(db, 'duplicate Normal / 52 is rejected', `insert into bills (bill_type,bill_number,bill_number_source,customer_id) values ('normal','52','manual',$1)`, /bills_number_unique_per_type/, [customerId])
await fails(db, 'blank bill number is rejected', `insert into bills (bill_type,bill_number,bill_number_source,customer_id) values ('normal','  ','manual',$1)`, /check/, [customerId])
await fails(db, 'unknown bill type is rejected', `insert into bills (bill_type,bill_number,bill_number_source,customer_id) values ('other','Z','manual',$1)`, /check/, [customerId])
const n1 = (await one(db, `select next_document_number('ev_bill','TST-EV',2026) n`)).n
const n2 = (await one(db, `select next_document_number('ev_bill','TST-EV',2026) n`)).n
eq('generated numbers are sequential (1)', n1, 'TST-EV-2026-000001')
eq('generated numbers are sequential (2)', n2, 'TST-EV-2026-000002')
await fails(db, 'unknown document type is rejected', `select next_document_number('nonsense','X',2026)`, /check|violates/)
await fails(db, 'staff cannot edit a numbering counter directly', `update document_sequences set last_number = 0`, /permission denied/)

// ---------------------------------------------------------------------------
console.log('\n== Ledger and payments ==')
await fails(db, 'payment against an un-posted bill is rejected', `select record_payment($1,$2,100,'cash')`, /must be posted/, [customerId, billId])
await db.query(`select post_bill_to_ledger($1)`, [billId])
ok('bill posted to ledger once')
await fails(db, 'posting the same bill twice is rejected (no double debit)', `select post_bill_to_ledger($1)`, /already posted/, [billId])
await fails(db, 'posted bill: cannot add a priced line', `insert into bill_items (bill_id, description, quantity, rate, amount) values ($1,'late',1,10,10)`, /posted to the ledger/, [billId])
await fails(db, 'posted bill: cannot change discount', `update bills set discount_amount = 1 where id=$1`, /posted to the ledger/, [billId])
await fails(db, 'posted bill: cannot change customer', `update bills set customer_id = (select id from customers limit 1), bill_number='X' where id=$1`, /posted to the ledger/, [billId])
await db.query(`update bills set notes = 'note edit is allowed' where id=$1`, [billId])
ok('posted bill: non-financial edits still allowed')
eq('staff sees no ledger rows (admin-only)', (await rows(db, 'select * from customer_ledger')).length, 0)
await fails(db, 'staff cannot insert a ledger row directly', `insert into customer_ledger (customer_id,transaction_type,debit,running_balance) values ($1,'adjustment',5,5)`, /permission denied/, [customerId])
await fails(db, 'staff cannot insert a payment directly', `insert into payments (payment_number,customer_id,amount,payment_mode) values ('P',$1,5,'cash')`, /permission denied/, [customerId])
await fails(db, 'staff cannot call the internal ledger primitive', `select append_ledger_entry($1,'adjustment',null,null,'x',5,0)`, /permission denied/, [customerId])
await fails(db, 'staff cannot post ledger adjustments', `select record_ledger_adjustment($1,'adjustment',5,0,'x')`, /Only an admin/, [customerId])
await fails(db, 'staff cannot cancel bills', `select cancel_bill($1,'x')`, /Only an admin/, [billId])

const other = (await one(db, `insert into customers (customer_name) values ('Test Customer B') returning id`)).id
await fails(db, 'payment naming a different customer than the bill is rejected', `select record_payment($1,$2,100,'cash')`, /does not belong/, [other, billId])
await fails(db, 'zero payment is rejected', `select record_payment($1,$2,0,'cash')`, /greater than zero/, [customerId, billId])
await fails(db, 'payment above balance due is rejected', `select record_payment($1,$2,24570.01,'cash')`, /exceeds the balance due/, [customerId, billId])
await fails(db, 'unknown payment mode is rejected', `select record_payment($1,$2,100,'barter')`, /check/, [customerId, billId])
const p1 = await one(db, `select * from record_payment($1,$2,10000,'cash','REF-1','partial')`, [null, billId])
eq('payment number generated from configured prefix', p1.payment_number.startsWith('PAY-'), true)
eq('payment.customer_id taken from the bill', p1.customer_id, customerId)
eq('payment.recorded_by is the session user', p1.recorded_by, STAFF)
b = await one(db, 'select * from bills where id=$1', [billId])
eq('after 10,000: amount_received', b.amount_received, '10000.00')
eq('after 10,000: balance_due', b.balance_due, '14570.00')
eq('after 10,000: partially_paid', b.payment_status, 'partially_paid')
await db.query(`select record_payment($1,$2,14570,'upi','REF-2',null)`, [customerId, billId])
b = await one(db, 'select * from bills where id=$1', [billId])
check('after final payment: paid, balance 0', b.payment_status === 'paid' && b.balance_due === '0.00', JSON.stringify(b))
await fails(db, 'no payment may exceed a settled bill', `select record_payment($1,$2,1,'cash')`, /exceeds the balance due/, [customerId, billId])
await db.query(`select record_payment($1,null,500,'cash','on-account',null)`, [other])
ok('on-account payment (no bill) recorded for a customer')

await asUser(db, ADMIN)
const led = await rows(db, `select * from customer_ledger where customer_id=$1 order by entry_seq`, [customerId])
eq('customer A ledger: 1 bill debit + 2 payment credits', led.length, 3)
eq('ledger debit for bill = 24,570', led[0].debit, '24570.00')
eq('ledger running balance after bill', led[0].running_balance, '24570.00')
eq('ledger running balance after 10,000', led[1].running_balance, '14570.00')
eq('ledger running balance after settling', led[2].running_balance, '0.00')
const chain = await one(db, `select count(*)::int bad from (
  select running_balance - (coalesce(lag(running_balance) over (partition by customer_id order by entry_seq),0) + debit - credit) d
  from customer_ledger) x where d <> 0`)
eq('every ledger row = previous balance + debit - credit', chain.bad, 0)
const otherLed = await rows(db, `select * from customer_ledger where customer_id=$1`, [other])
check('on-account payment credited only customer B (balance -500)', otherLed.length === 1 && otherLed[0].running_balance === '-500.00', JSON.stringify(otherLed))
eq('payments received per bill match bills.amount_received',
  (await one(db, `select coalesce(sum(p.amount),0) s from payments p where p.bill_id=$1`, [billId])).s, (await one(db, 'select amount_received from bills where id=$1', [billId])).amount_received)
const dupes = await one(db, `select count(*)::int c from (select transaction_type, reference_id from customer_ledger where reference_id is not null group by 1,2 having count(*)>1) x`)
eq('no ledger reference posted twice', dupes.c, 0)

// cancel flow
await asUser(db, STAFF)
const b2 = (await one(db, `insert into bills (bill_type,bill_number,bill_number_source,customer_id,other_charges) values ('normal','53','manual',$1,100) returning id`, [customerId])).id
await db.query(`insert into bill_items (bill_id, description, quantity, rate, amount) values ($1,'Sample line',2,50,100)`, [b2])
eq('bill 53 total = 100 lines + 100 other charges', (await one(db, 'select grand_total from bills where id=$1', [b2])).grand_total, '200.00')
await db.query(`select post_bill_to_ledger($1)`, [b2])
await db.query(`select record_payment(null,$1,50,'cash')`, [b2])
await asUser(db, ADMIN)
await fails(db, 'a bill with payments cannot be cancelled', `select cancel_bill($1,'oops')`, /payments recorded/, [b2])
const b3 = (await one(db, `insert into bills (bill_type,bill_number,bill_number_source,customer_id) values ('normal','54','manual',$1) returning id`, [customerId])).id
await db.query(`insert into bill_items (bill_id, description, quantity, rate, amount) values ($1,'Sample line',1,300,300)`, [b3])
await db.query(`select post_bill_to_ledger($1)`, [b3])
const before = (await one(db, `select running_balance from customer_ledger where customer_id=$1 order by entry_seq desc limit 1`, [customerId])).running_balance
await fails(db, 'cancelling needs a reason', `select cancel_bill($1,'  ')`, /reason is required/, [b3])
await db.query(`select cancel_bill($1,'entered by mistake')`, [b3])
const after = (await one(db, `select running_balance from customer_ledger where customer_id=$1 order by entry_seq desc limit 1`, [customerId])).running_balance
check('cancelling a posted bill reverses its ledger debit', Number(after) === Number(before) - 300, `${before} -> ${after}`)
eq('cancelled bill status', (await one(db, 'select status from bills where id=$1', [b3])).status, 'cancelled')
await fails(db, 'a cancelled bill cannot be posted or paid again', `select record_payment(null,$1,1,'cash')`, /cancelled/, [b3])
await db.query(`select record_ledger_adjustment($1,'opening_balance',1000,0,'carried forward (test)')`, [other])
ok('admin can post an opening balance with a description')
await fails(db, 'adjustment without description is rejected', `select record_ledger_adjustment($1,'adjustment',1,0,'')`, /description is required/, [other])
await fails(db, 'adjustment with both debit and credit is rejected', `select record_ledger_adjustment($1,'adjustment',1,1,'both')`, /ledger_one_side/, [other])

// delete rules
await asUser(db, STAFF)
const d1 = await db.query(`delete from bills where id=$1`, [b3])
eq('staff cannot delete a bill', d1.affectedRows, 0)
await asUser(db, ADMIN)
const unposted = (await one(db, `insert into bills (bill_type,bill_number,bill_number_source,customer_id) values ('ev','E-1','manual',$1) returning id`, [customerId])).id
eq('admin can delete an un-posted bill', (await db.query(`delete from bills where id=$1`, [unposted])).affectedRows, 1)
eq('admin cannot delete a posted bill', (await db.query(`delete from bills where id=$1`, [billId])).affectedRows, 0)

// ---------------------------------------------------------------------------
console.log('\n== Stock ==')
await asUser(db, STAFF)
const mat = (await asOwner(db), await one(db, `insert into materials (name, category) values ('Sample Block','block') returning id`)).id
await asUser(db, STAFF)
await fails(db, 'staff cannot create stock with a preset quantity', `insert into stock_items (material_id, quantity_on_hand) values ($1, 5)`, /permission denied/, [mat])
const si = (await one(db, `insert into stock_items (material_id, batch_code) values ($1,'B-1') returning id`, [mat])).id
eq('new stock item starts at 0', (await one(db, 'select quantity_on_hand q from stock_items where id=$1', [si])).q, '0.000')
await fails(db, 'direct UPDATE of quantity_on_hand is denied', `update stock_items set quantity_on_hand = 999 where id=$1`, /permission denied/, [si])
await fails(db, 'direct INSERT into stock_movements is denied', `insert into stock_movements (stock_item_id,movement_type,quantity_change,previous_quantity,new_quantity) values ($1,'receipt',5,0,5)`, /permission denied/, [si])
const mv = async (type, qty) => db.query(`select apply_stock_movement($1,$2,$3,'manual',null,'test')`, [si, type, qty])
await mv('opening_stock', 100); await mv('receipt', 50); await mv('sale', -30); await mv('adjustment', -5); await mv('damage', -2)
const bal = await one(db, 'select * from stock_balances where stock_item_id=$1', [si])
eq('opening', bal.opening_quantity, '100.000'); eq('received', bal.received_quantity, '50.000')
eq('used/sold (sale 30 + damage 2)', bal.used_quantity, '32.000'); eq('adjustments', bal.adjustment_quantity, '-5.000')
eq('current = 100 + 50 - 32 - 5', bal.current_quantity, '113.000')
eq('quantity_on_hand equals the movement-derived current', bal.quantity_on_hand, bal.current_quantity)
await fails(db, 'cannot sell more than on hand', `select apply_stock_movement($1,'sale',-1000)`, /Insufficient stock/, [si])
await fails(db, 'a sale must reduce stock', `select apply_stock_movement($1,'sale',5)`, /stock_movement_direction/, [si])
await fails(db, 'a receipt must add stock', `select apply_stock_movement($1,'receipt',-5)`, /stock_movement_direction/, [si])
await fails(db, 'a zero movement is rejected', `select apply_stock_movement($1,'adjustment',0)`, /stock_movement_nonzero/, [si])
const hist = await one(db, `select count(*)::int c, bool_and(new_quantity = previous_quantity + quantity_change) chain, bool_and(performed_by = $2) who from stock_movements where stock_item_id=$1`, [si, STAFF])
check('movement history is internally consistent and attributed to the session user', hist.c === 5 && hist.chain && hist.who, JSON.stringify(hist))
await fails(db, 'stock movements cannot be edited', `update stock_movements set quantity_change = 1`, /permission denied/)
await fails(db, 'stock movements cannot be deleted', `delete from stock_movements`, /permission denied/)

// ---------------------------------------------------------------------------
console.log('\n== Measurement sheet ==')
const countAll = async () => (await asOwner(db), (await one(db, `select (select count(*) from bills)::int b, (select count(*) from payments)::int p, (select count(*) from customer_ledger)::int l, (select count(*) from stock_movements)::int s, (select count(*) from stock_items)::int i`)))
const beforeCounts = await countAll()
await asUser(db, STAFF)
const sheet = (await one(db, `insert into measurement_sheets (sheet_date, party_name_text, stated_total) values ('2026-07-01','Test party (unclear on paper)', 234685) returning id`)).id
const sheetRows = [
  [1, '54 × 24 × 09', 'M', 108, 520, 56160], [2, '52 × 18 × 9.5"', 'M', 78, 520, 40560],
  [3, '52 × 18 × 9.5"', 'M', 78, 520, 40560], [4, '51 × 18 × 9.5"', 'M', 76.5, 520, 39780],
  [5, '45 × 18 × 12"', 'M', 67.5, 550, 37125], [6, '7 × 36 × 08', '①M', 21, 460, 9660],
  [7, '7.5 × 12 × 7.25"', '3M', 22.5, 400, 9000], [8, `3.5' × 15 × 08"`, '1M', 4, 460, 1840],
]
for (const r of sheetRows) await db.query(`insert into measurement_sheet_rows (sheet_id,row_no,measurement_text,pcs_text,quantity,rate,amount,sort_order) values ($1,$2,$3,$4,$5,$6,$7,$2)`, [sheet, ...r])
const ver = await one(db, 'select * from measurement_sheet_verification where sheet_id=$1', [sheet])
eq('eight rows stored', ver.row_count, 8)
eq('row amounts sum to 2,34,685', ver.rows_amount_sum, '234685.00')
eq('stated total 2,34,685', ver.stated_total, '234685.00')
eq('stated total - row sum = 0', ver.difference, '0.00')
eq('every row: amount = quantity x rate (verification only)', ver.rows_where_amount_differs_from_qty_x_rate, 0)
const r6 = await one(db, `select * from measurement_sheet_rows where sheet_id=$1 and row_no=6`, [sheet])
check('row 6: PCS text and ₹460 rate preserved exactly', r6.pcs_text === '①M' && r6.rate === '460.00' && r6.measurement_text === '7 × 36 × 08', JSON.stringify(r6))
eq(`row 8: measurement text preserved verbatim`, (await one(db, `select measurement_text t from measurement_sheet_rows where sheet_id=$1 and row_no=8`, [sheet])).t, `3.5' × 15 × 08"`)
await db.query(`insert into measurement_sheet_rows (sheet_id,row_no,measurement_text) values ($1,9,'blank cells row')`, [sheet])
const blank = await one(db, `select * from measurement_sheet_rows where sheet_id=$1 and row_no=9`, [sheet])
check('blank cells on a row stay NULL, never 0', blank.pcs_text === null && blank.quantity === null && blank.rate === null && blank.amount === null)
await db.query(`insert into measurement_sheets (party_name_text) values (null)`)
ok('a sheet with no number, date, customer or total is valid (all blank on paper)')
await db.query(`insert into measurement_sheet_rows (sheet_id,row_no,measurement_text,quantity,rate,amount) values ($1,10,'deliberate mismatch',2,10,999)`, [sheet])
ok('a row whose amount != quantity x rate is NOT rejected (formula not enforced)…')
eq('…but is reported by the verification view', (await one(db, 'select rows_where_amount_differs_from_qty_x_rate n from measurement_sheet_verification where sheet_id=$1', [sheet])).n, 1)
await db.query(`delete from measurement_sheet_rows where sheet_id=$1 and row_no in (9,10)`, [sheet])
await db.query(`select * from measurement_sheet_verification`)
check('creating/reading a sheet created no bill, payment, ledger or stock rows', JSON.stringify(await countAll()) === JSON.stringify(beforeCounts), JSON.stringify([beforeCounts, await countAll()]))
await asUser(db, STAFF)

// ---------------------------------------------------------------------------
console.log('\n== Role security (RLS + grants) ==')
await asUser(db, STAFF)
eq('staff cannot read expenses', (await rows(db, 'select * from expenses')).length, 0)
await fails(db, 'staff cannot insert expenses', `insert into expenses (expense_number,category,amount) values ('E1','fuel',10)`, /row-level security/)
eq('staff update of settings changes 0 rows', (await db.query(`update settings set value='{"x":1}' where key='business_profile'`)).affectedRows, 0)
eq('staff cannot read audit logs', (await rows(db, 'select * from audit_logs')).length, 0)
await fails(db, 'staff cannot forge audit rows', `insert into audit_logs (actor_id,action,module) values ('${ADMIN}','x','x')`, /permission denied/)
eq('staff cannot change roles (0 rows)', (await db.query(`update staff_profiles set role='admin' where user_id='${STAFF}'`)).affectedRows, 0)
eq('staff can read the roster (no RLS recursion)', (await rows(db, 'select * from staff_profiles')).length, 3)
eq('staff cannot write materials (0 rows)', (await db.query(`update materials set name='hacked'`)).affectedRows, 0)
await fails(db, 'staff cannot define units', `insert into units (code,label) values ('x','x')`, /row-level security/)
check('staff can read bill payment fields (amount received)', (await rows(db, 'select amount_received from bills')).length > 0)

await asUser(db, ADMIN)
await db.query(`insert into expenses (expense_number,category,amount,expense_time) values ('EXP-T1','fuel',1250.50,'09:30')`)
eq('admin can record an expense', (await rows(db, 'select * from expenses')).length, 1)
eq('admin can change a setting', (await db.query(`update settings set value='{"name":"Test"}' where key='business_profile'`)).affectedRows, 1)
await db.query(`insert into units (code,label) values ('TEST-U','Test Unit')`)
ok('admin can define units')
check('admin can read the audit log', (await rows(db, 'select * from audit_logs')).length > 0)
await fails(db, 'even admin cannot edit the audit log', `update audit_logs set action='x'`, /permission denied/)
await fails(db, 'even admin cannot delete ledger rows', `delete from customer_ledger`, /permission denied/)
await fails(db, 'even admin cannot insert a ledger row directly', `insert into customer_ledger (customer_id,transaction_type,debit,running_balance) values ('${customerId}','adjustment',1,1)`, /permission denied/)

await asUser(db, STAFF2_INACTIVE)
eq('inactive staff see no customers', (await rows(db, 'select * from customers')).length, 0)
await fails(db, 'inactive staff cannot create bills', `insert into bills (bill_type,bill_number,bill_number_source,customer_id) values ('normal','Z9','manual','${customerId}')`, /row-level security/)
await fails(db, 'inactive staff cannot record payments', `select record_payment('${customerId}',null,5,'cash')`, /Not authorized/)
await asUser(db, NOBODY)
eq('a signed-in user with no profile sees no customers', (await rows(db, 'select * from customers')).length, 0)
await fails(db, 'a signed-in user with no profile cannot generate numbers', `select next_document_number('quotation','Q',2026)`, /Not authorized/)
await fails(db, 'a signed-in user with no profile cannot move stock', `select apply_stock_movement('${si}','receipt',1)`, /Not authorized/)
await asUser(db, null, 'anon')
for (const t of ['customers','bills','customer_ledger','payments','stock_items','measurement_sheets','expenses','audit_logs','settings','staff_profiles']) {
  await fails(db, `anon cannot read ${t}`, `select * from ${t}`, /permission denied/)
}
await fails(db, 'anon cannot call record_payment', `select record_payment('${customerId}',null,5,'cash')`, /permission denied/)
await fails(db, 'anon cannot call next_document_number', `select next_document_number('quotation','Q',2026)`, /permission denied/)

// ---------------------------------------------------------------------------
console.log('\n== Function privileges ==')
await asOwner(db)
const fns = await rows(db, `select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef secdef, p.proconfig from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f'`)
const clientFns = new Set(['apply_stock_movement','next_document_number','post_bill_to_ledger','record_payment','cancel_bill','record_ledger_adjustment','current_role_is','is_active_staff'])
for (const f of fns) {
  const anon = (await one(db, `select has_function_privilege('anon', $1::oid, 'execute') x`, [f.oid])).x
  const auth = (await one(db, `select has_function_privilege('authenticated', $1::oid, 'execute') x`, [f.oid])).x
  const trig = /trigger/.test((await one(db, `select prorettype::regtype::text t from pg_proc where oid=$1`, [f.oid])).t)
  if (trig || ['auth'].includes(f.proname)) continue
  eq(`${f.proname}(): anon has no EXECUTE`, anon, false)
  eq(`${f.proname}(): authenticated EXECUTE only if it is a client entry point`, auth, clientFns.has(f.proname))
}
const definers = fns.filter((f) => f.secdef)
check('every SECURITY DEFINER function pins search_path', definers.every((f) => (f.proconfig ?? []).some((c) => c.startsWith('search_path='))),
  definers.filter((f) => !(f.proconfig ?? []).some((c) => c.startsWith('search_path='))).map((f) => f.proname).join(','))

// ---------------------------------------------------------------------------
console.log('\n== Audit trail ==')
await asOwner(db)
const aud = await rows(db, `select module, action, count(*)::int c from audit_logs group by 1,2`)
const has = (m, a) => aud.some((r) => r.module === m && r.action === a)
for (const [m, a] of [['bills','INSERT'],['bills','UPDATE'],['bill_items','INSERT'],['payments','INSERT'],['customer_ledger','INSERT'],['customers','INSERT'],['stock_movements','INSERT'],['stock_items','UPDATE'],['expenses','INSERT'],['settings','UPDATE'],['measurement_sheets','INSERT'],['measurement_sheet_rows','INSERT'],['measurement_sheet_rows','DELETE'],['bills','DELETE']]) {
  check(`audit: ${a} on ${m} is recorded`, has(m, a))
}
const who = await one(db, `select count(*)::int c from audit_logs where module='payments' and actor_id = '${STAFF}'`)
check('audit rows carry the acting user', who.c >= 3)
eq('no-op updates (only updated_at) are not logged', (await one(db, `select count(*)::int c from audit_logs where action='UPDATE' and previous_values - 'updated_at' = new_values - 'updated_at'`)).c, 0)
const leak = await one(db, `select count(*)::int c from audit_logs where new_values::text ~* 'service_role|password|secret|api_key'`)
eq('audit log contains no credential-like values', leak.c, 0)

// ---------------------------------------------------------------------------
console.log('\n== Central database ==')
const C1 = '00000000-0000-0000-0000-0000000000d1', C2 = '00000000-0000-0000-0000-0000000000d2'
await asOwner(central)
await central.exec(`
  insert into auth.users (id,email) values ('${C1}','super@test'),('${C2}','plain@test');
  insert into central_users (id,full_name,is_super_admin) values ('${C1}','Super',true),('${C2}','Plain',false);
  insert into central_user_business_access (user_id,business_id,role)
    select '${C2}', id, 'staff' from central_businesses where code='kmg';
  update central_businesses set status='inactive' where code='murudeshwara';
`)
await asUser(central, C2)
eq('plain central user sees only ACTIVE businesses', (await rows(central, 'select code from central_businesses')).map((r) => r.code).join(','), 'kmg')
eq('plain central user sees only their own access rows', (await rows(central, 'select * from central_user_business_access')).length, 1)
eq('plain central user cannot read the audit log', (await rows(central, 'select * from central_audit_logs')).length, 0)
await fails(central, 'plain central user cannot add a business', `insert into central_businesses (code,name,legal_name) values ('x','x','x')`, /row-level security/)
eq('plain central user cannot grant themselves access (0 rows)', (await central.query(`update central_user_business_access set role='admin'`)).affectedRows, 0)
await asUser(central, C1)
eq('super admin sees the registry incl. inactive', (await rows(central, 'select * from central_businesses')).length, 2)
await central.query(`insert into central_businesses (code,name,legal_name) values ('future','Future','Future')`)
ok('super admin can register a business')
await asUser(central, null, 'anon')
await fails(central, 'anon cannot read central_businesses', `select * from central_businesses`, /permission denied/)

// ---------------------------------------------------------------------------
console.log(`\n${passed} checks passed, ${failures.length} failed`)
if (failures.length) { console.log('\nFAILURES:\n - ' + failures.join('\n - ')); process.exit(1) }
