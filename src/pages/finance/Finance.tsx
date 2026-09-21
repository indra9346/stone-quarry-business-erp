import { useState } from 'react'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { fetchAllPages } from '@/lib/csv'
import { expenseColumns, ledgerColumns, paymentColumns } from '@/lib/exportColumns'
import { WhenAdmin, WhenCan } from '@/features/auth/WhenCan'
import { Link } from 'react-router-dom'
import { Plus, Wallet } from 'lucide-react'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizMutation, useBizQuery } from '@/hooks/useBiz'
import { useCustomerPicker, usePrefix, useVehiclePicker } from '@/hooks/useLookups'
import { createExpense, expenseSummary, ledgerAdjustment, listExpenses, listLedger, listPayments, type ExpenseRow, type PaymentRow } from '@/services/finance'
import { generateNumber } from '@/services/bills'
import { PAGE_SIZE } from '@/services/common'
import { Card, CurrencyDisplay, DateRangePicker, FilterBar, KpiCard, PageHeader } from '@/components/ui/layout'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { FormField, Input, Select, Textarea } from '@/components/ui/form'
import { EmptyState } from '@/components/ui/feedback'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import RecordPaymentDialog from '@/features/payments/RecordPaymentDialog'
import { formatDate, formatTime, parseOptionalNumber, todayIST } from '@/lib/format'
import type { ExpenseCategory, LedgerEntry, PaymentMode } from '@/types/db'

/* ============================================================== PAYMENTS */
export function PaymentsPage() {
  const { code } = useBusinessContext()
  const customers = useCustomerPicker()
  const [customerId, setCustomerId] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(false)
  const query = useBizQuery(['payments', 'list', customerId, range.from, range.to, page], (c) =>
    listPayments(c, { customerId: customerId || undefined, from: range.from || undefined, to: range.to || undefined, page }),
  )
  const columns: Column<PaymentRow>[] = [
    { key: 'no', header: 'Payment no.', cell: (p) => <span className="font-medium text-stone-900">{p.payment_number}</span> },
    { key: 'date', header: 'Date', sortValue: (p) => p.payment_date, cell: (p) => <>{formatDate(p.payment_date)} <span className="ml-1.5 text-xs text-stone-400">{formatTime(p.created_at)}</span></> },
    { key: 'cust', header: 'Customer', cell: (p) => <Link className="text-amber-800 hover:underline" to={`/business/${code}/customers/${p.customer_id}`}>{p.customers?.customer_name ?? '—'}</Link> },
    { key: 'bill', header: 'Against bill', cell: (p) => (p.bills ? <Link className="text-amber-800 hover:underline" to={`/business/${code}/bills/${p.bill_id}`}>{p.bills.bill_number}</Link> : <span className="text-stone-500">On account</span>) },
    { key: 'mode', header: 'Mode', cell: (p) => p.payment_mode.replace('_', ' ') },
    { key: 'ref', header: 'Reference', cell: (p) => p.reference_number ?? '—' },
    { key: 'amt', header: 'Amount', numeric: true, sortValue: (p) => p.amount, cell: (p) => <CurrencyDisplay value={p.amount} className="font-medium text-emerald-700" /> },
  ]
  return (
    <div>
      <PageHeader
        title="Payments"
        description="Money received from customers. Payments are recorded once and cannot be edited or deleted."
        actions={
          <>
            <ExportCsvButton name="payments" columns={paymentColumns} load={(c) => fetchAllPages((p) => listPayments(c, { customerId: customerId || undefined, from: range.from || undefined, to: range.to || undefined, page: p }))} />
            <WhenCan module="payments"><Button variant="accent" onClick={() => setOpen(true)}><Wallet className="h-4 w-4" /> Record payment</Button></WhenCan>
          </>
        }
      />
      <Card>
        <FilterBar>
          <div className="w-56">
            <span className="mb-1 block text-xs font-medium text-stone-600">Customer</span>
            <SearchableSelect
              value={customerId}
              onChange={(val) => { setCustomerId(val); setPage(0) }}
              placeholder="All customers"
              options={[
                { value: '', label: 'All customers' },
                ...(customers.data ?? []).map((c) => ({
                  value: c.id,
                  label: c.customer_name,
                  sublabel: c.gstin ? `GST: ${c.gstin}` : c.billing_address || undefined,
                })),
              ]}
            />
          </div>
          <DateRangePicker from={range.from} to={range.to} onChange={(r) => { setRange(r); setPage(0) }} />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={query.data?.rows}
          rowKey={(p) => p.id}
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          empty={{ title: 'No payments recorded', description: 'Payments appear here once recorded against a customer or bill.' }}
          pagination={{ page, pageSize: PAGE_SIZE, total: query.data?.total ?? 0, onPageChange: setPage }}
        />
      </Card>
      <RecordPaymentDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

/* =============================================================== LEDGER */
export function LedgerPage() {
  const customers = useCustomerPicker()
  const [customerId, setCustomerId] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [page, setPage] = useState(0)
  const [adjusting, setAdjusting] = useState(false)
  const query = useBizQuery(['ledger', 'list', customerId, range.from, range.to, page], (c) =>
    listLedger(c, { customerId, from: range.from || undefined, to: range.to || undefined, page }),
    { enabled: !!customerId },
  )
  const { code } = useBusinessContext()

  const columns: Column<LedgerEntry>[] = [
    { key: 'date', header: 'Date', cell: (e) => <>{formatDate(e.transaction_date)} <span className="ml-1.5 text-xs text-stone-400">{formatTime(e.created_at)}</span></> },
    { key: 'type', header: 'Transaction', cell: (e) => <StatusBadge tone={e.transaction_type === 'payment' ? 'success' : e.transaction_type === 'bill' ? 'info' : 'neutral'}>{e.transaction_type.replace('_', ' ')}</StatusBadge> },
    {
      key: 'ref',
      header: 'Reference',
      cell: (e) =>
        e.reference_type === 'bill' && e.reference_id ? (
          <Link className="text-amber-800 hover:underline" to={`/business/${code}/bills/${e.reference_id}`}>{e.description ?? 'Bill'}</Link>
        ) : (
          e.description ?? '—'
        ),
    },
    { key: 'debit', header: 'Debit', numeric: true, cell: (e) => (e.debit > 0 ? <CurrencyDisplay value={e.debit} /> : <span className="text-stone-300">—</span>) },
    { key: 'credit', header: 'Credit', numeric: true, cell: (e) => (e.credit > 0 ? <CurrencyDisplay value={e.credit} className="text-emerald-700" /> : <span className="text-stone-300">—</span>) },
    { key: 'bal', header: 'Balance', numeric: true, cell: (e) => <CurrencyDisplay value={e.running_balance} className="font-medium" /> },
  ]

  return (
    <div>
      <PageHeader
        title="Customer ledger"
        description="Bills debit the customer; payments credit them. The balance is what the customer still owes. Entries are system-generated and cannot be edited."
        actions={
          customerId ? (
            <>
              <ExportCsvButton name="customer-ledger" columns={ledgerColumns} load={(c) => fetchAllPages((p) => listLedger(c, { customerId, from: range.from || undefined, to: range.to || undefined, page: p }))} />
              <WhenAdmin><Button onClick={() => setAdjusting(true)}>Opening balance / adjustment</Button></WhenAdmin>
            </>
          ) : undefined
        }
      />
      <Card>
        <FilterBar>
          <div className="w-64">
            <span className="mb-1 block text-xs font-medium text-stone-600">Customer</span>
            <SearchableSelect
              value={customerId}
              onChange={(val) => { setCustomerId(val); setPage(0) }}
              placeholder="Select a customer…"
              options={(customers.data ?? []).map((c) => ({
                value: c.id,
                label: c.customer_name,
                sublabel: c.gstin ? `GST: ${c.gstin}` : c.billing_address || undefined,
              }))}
            />
          </div>
          <DateRangePicker from={range.from} to={range.to} onChange={(r) => { setRange(r); setPage(0) }} />
        </FilterBar>
        {!customerId ? (
          <EmptyState title="Choose a customer" description="Select a customer to see their ledger, most recent entry first." />
        ) : (
          <DataTable
            columns={columns}
            rows={query.data?.rows}
            rowKey={(e) => e.id}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
            empty={{ title: 'No ledger entries', description: 'Entries appear when a bill is posted or a payment is recorded.' }}
            pagination={{ page, pageSize: PAGE_SIZE, total: query.data?.total ?? 0, onPageChange: setPage }}
          />
        )}
      </Card>
      {customerId && <AdjustmentDialog open={adjusting} onOpenChange={setAdjusting} customerId={customerId} />}
    </div>
  )
}

function AdjustmentDialog({ open, onOpenChange, customerId }: { open: boolean; onOpenChange: (o: boolean) => void; customerId: string }) {
  const [type, setType] = useState<'opening_balance' | 'adjustment'>('opening_balance')
  const [side, setSide] = useState<'debit' | 'credit'>('debit')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const save = useBizMutation(ledgerAdjustment, { invalidate: [['ledger'], ['customers'], ['dashboard']], onSuccess: () => { setAmount(''); setDescription(''); onOpenChange(false) } })
  function submit() {
    const n = parseOptionalNumber(amount)
    if (n === null || Number.isNaN(n) || n <= 0) return setError('Enter an amount greater than zero.')
    if (!description.trim()) return setError('A description is required.')
    setError(null)
    save.mutate({ customerId, type, debit: side === 'debit' ? n : null, credit: side === 'credit' ? n : null, description: description.trim() }, { onError: (e) => setError(e.message) })
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Opening balance / adjustment" description="Admin only. Adds one ledger entry that cannot be edited afterwards."
      footer={<><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={submit}>Post entry</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Type">{(p) => <Select {...p} value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="opening_balance">Opening balance</option><option value="adjustment">Adjustment</option></Select>}</FormField>
        <FormField label="Effect">{(p) => <Select {...p} value={side} onChange={(e) => setSide(e.target.value as typeof side)}><option value="debit">Customer owes more (debit)</option><option value="credit">Customer owes less (credit)</option></Select>}</FormField>
        <FormField label="Amount (₹)" required>{(p) => <Input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}</FormField>
        <FormField label="Description" required className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</FormField>
      </div>
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
    </Modal>
  )
}

/* ============================================================== EXPENSES */
const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'fuel', label: 'Fuel' }, { value: 'labour', label: 'Labour' }, { value: 'vehicle', label: 'Vehicle' },
  { value: 'factory', label: 'Factory' }, { value: 'quarry', label: 'Quarry' }, { value: 'maintenance', label: 'Maintenance' },
  { value: 'electricity', label: 'Electricity' }, { value: 'transport', label: 'Transport' }, { value: 'office', label: 'Office' }, { value: 'other', label: 'Other' },
]

export function ExpensesPage() {
  const [category, setCategory] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [page, setPage] = useState(0)
  const [adding, setAdding] = useState(false)
  const vehicles = useVehiclePicker()
  const list = useBizQuery(['expenses', 'list', category, vehicleId, range.from, range.to, page], (c) => listExpenses(c, { category: category || undefined, vehicleId: vehicleId || undefined, from: range.from || undefined, to: range.to || undefined, page }))
  const summary = useBizQuery(['expenses', 'summary', vehicleId, range.from, range.to], (c) => expenseSummary(c, { vehicleId: vehicleId || undefined, from: range.from || undefined, to: range.to || undefined }))

  const columns: Column<ExpenseRow>[] = [
    { key: 'no', header: 'Expense no.', cell: (e) => <span className="font-medium text-stone-900">{e.expense_number}</span> },
    { key: 'date', header: 'Date', sortValue: (e) => e.expense_date, cell: (e) => `${formatDate(e.expense_date)}${e.expense_time ? ` ${e.expense_time.slice(0, 5)}` : ''}` },
    { key: 'cat', header: 'Category', cell: (e) => <StatusBadge>{e.category}</StatusBadge> },
    { key: 'veh', header: 'Vehicle', cell: (e) => e.vehicles?.registration_number ?? '—' },
    { key: 'desc', header: 'Description', wrap: true, cell: (e) => e.description ?? '—' },
    { key: 'vendor', header: 'Vendor', cell: (e) => e.vendor_name ?? '—' },
    { key: 'amt', header: 'Amount', numeric: true, sortValue: (e) => e.amount, cell: (e) => <CurrencyDisplay value={e.amount} className="font-medium" /> },
  ]
  return (
    <div>
      <PageHeader title="Expenses" description="Money the business spends. Not connected to customer payments or to any person by phone number."
        actions={
          <>
            <ExportCsvButton name="expenses" columns={expenseColumns} load={(c) => fetchAllPages((p) => listExpenses(c, { category: category || undefined, vehicleId: vehicleId || undefined, from: range.from || undefined, to: range.to || undefined, page: p }))} />
            <WhenCan module="expenses"><Button variant="accent" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add expense</Button></WhenCan>
          </>
        } />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total in range" loading={summary.isLoading} value={<CurrencyDisplay value={summary.data?.total} />} hint={summary.data ? `${summary.data.count} expense${summary.data.count === 1 ? '' : 's'}` : undefined} />
        {summary.data?.byCategory.slice(0, 2).map(([cat, total]) => <KpiCard key={cat} label={cat} value={<CurrencyDisplay value={total} />} />)}
      </div>
      <Card>
        <FilterBar>
          <label className="block text-xs font-medium text-stone-600">
            Category
            <Select className="mt-1 w-40" value={category} onChange={(e) => { setCategory(e.target.value); setPage(0) }}>
              <option value="">All</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </label>
          <div className="w-48">
            <span className="mb-1 block text-xs font-medium text-stone-600">Vehicle</span>
            <SearchableSelect
              value={vehicleId}
              onChange={(val) => { setVehicleId(val); setPage(0) }}
              placeholder="All vehicles"
              options={[
                { value: '', label: 'All vehicles' },
                ...(vehicles.data ?? []).map((v) => ({
                  value: v.id,
                  label: v.registration_number,
                  sublabel: v.vehicle_type || undefined,
                })),
              ]}
            />
          </div>
          <DateRangePicker from={range.from} to={range.to} onChange={(r) => { setRange(r); setPage(0) }} />
        </FilterBar>
        <DataTable columns={columns} rows={list.data?.rows} rowKey={(e) => e.id} loading={list.isLoading} error={list.error} onRetry={() => void list.refetch()}
          empty={{ title: 'No expenses recorded' }} pagination={{ page, pageSize: PAGE_SIZE, total: list.data?.total ?? 0, onPageChange: setPage }} />
      </Card>
      <ExpenseDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}

function ExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const prefix = usePrefix('expense')
  const [category, setCategory] = useState<ExpenseCategory>('fuel')
  const [date, setDate] = useState(todayIST())
  const [time, setTime] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [vendor, setVendor] = useState('')
  const [mode, setMode] = useState<PaymentMode | ''>('')
  const [reference, setReference] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const vehicles = useVehiclePicker()
  const [error, setError] = useState<string | null>(null)
  const save = useBizMutation(
    async (c, i: { amount: number }) => {
      const number = await generateNumber(c, 'expense', prefix)
      await createExpense(c, {
        expense_number: number, expense_date: date, expense_time: time || null, category, amount: i.amount,
        description: description.trim() || null, vendor_name: vendor.trim() || null, payment_mode: mode || null,
        reference_number: reference.trim() || null, vehicle_id: vehicleId || null, trip_id: null, notes: null,
      })
    },
    { invalidate: [['expenses']], onSuccess: () => { setAmount(''); setDescription(''); setVendor(''); setReference(''); setVehicleId(''); onOpenChange(false) } },
  )
  function submit() {
    const n = parseOptionalNumber(amount)
    if (n === null || Number.isNaN(n) || n <= 0) return setError('Enter an amount greater than zero.')
    setError(null)
    save.mutate({ amount: n }, { onError: (e) => setError(e.message) })
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add expense" footer={<><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={submit}>Save expense</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Category" required>{(p) => <Select {...p} value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select>}</FormField>
        <FormField label="Amount (₹)" required>{(p) => <Input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}</FormField>
        <FormField label="Date" required>{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</FormField>
        <FormField label="Time">{(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</FormField>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-stone-600">
            Vehicle
            <span className="ml-1 text-[11px] font-normal text-stone-400">(Optional: fuel, repairs, tyres...)</span>
          </label>
          <SearchableSelect
            value={vehicleId}
            onChange={setVehicleId}
            placeholder="Not for a vehicle"
            options={[
              { value: '', label: 'Not for a vehicle' },
              ...(vehicles.data ?? []).map((v) => ({
                value: v.id,
                label: v.registration_number,
                sublabel: v.vehicle_type || undefined,
              })),
            ]}
          />
        </div>
        <FormField label="Description" className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</FormField>
        <FormField label="Vendor / paid to (name)">{(p) => <Input {...p} value={vendor} onChange={(e) => setVendor(e.target.value)} />}</FormField>
        <FormField label="Payment mode">{(p) => <Select {...p} value={mode} onChange={(e) => setMode(e.target.value as PaymentMode | '')}><option value="">—</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option></Select>}</FormField>
        <FormField label="Reference no." className="sm:col-span-2">{(p) => <Input {...p} value={reference} onChange={(e) => setReference(e.target.value)} />}</FormField>
      </div>
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
    </Modal>
  )
}
