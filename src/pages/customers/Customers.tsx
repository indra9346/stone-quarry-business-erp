import { useEffect, useState } from 'react'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { fetchAllPages } from '@/lib/csv'
import { customerColumns } from '@/lib/exportColumns'
import { WhenCan } from '@/features/auth/WhenCan'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Plus, Wallet } from 'lucide-react'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizMutation, useBizQuery } from '@/hooks/useBiz'
import { useDebounce } from '@/hooks/useDebounce'
import { createCustomer, getCustomer, listCustomers, updateCustomer, type CustomerInput } from '@/services/catalog'
import { listBills } from '@/services/bills'
import { listQuotations } from '@/services/documents'
import { ledgerBalance, listPayments } from '@/services/finance'
import { PAGE_SIZE } from '@/services/common'
import { Card, CardHeader, CurrencyDisplay, FilterBar, KpiCard, PageHeader, SearchBar } from '@/components/ui/layout'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { FormField, Input, Select, Textarea } from '@/components/ui/form'
import { BillStateBadge, QuotationStatusBadge, StatusBadge } from '@/components/ui/StatusBadge'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import RecordPaymentDialog from '@/features/payments/RecordPaymentDialog'
import { formatDate } from '@/lib/format'
import type { Customer } from '@/types/db'

const blank = (): CustomerInput => ({
  customer_name: '', company_name: null, phone: null, alternate_phone: null, email: null, billing_address: null,
  shipping_address: null, city: null, state: null, pincode: null, gstin: null, notes: null, status: 'active',
})

export function CustomerFormDialog({ open, onOpenChange, customer, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; customer?: Customer; onSaved?: (id: string) => void }) {
  const [f, setF] = useState<CustomerInput>(blank())
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setError(null)
      setF(customer ? { ...customer } : blank())
    }
  }, [open, customer])
  const set = <K extends keyof CustomerInput>(k: K, v: string) => setF((s) => ({ ...s, [k]: (v === '' && k !== 'customer_name' ? null : v) as CustomerInput[K] }))

  const save = useBizMutation(
    async (c, input: CustomerInput) => {
      if (customer) {
        const { customer_code: _cc, ...rest } = input
        void _cc
        await updateCustomer(c, customer.id, rest)
        return customer.id
      }
      return (await createCustomer(c, input)).id
    },
    { invalidate: [['customers']], onSuccess: (id) => { onOpenChange(false); onSaved?.(id) } },
  )

  function submit() {
    if (!f.customer_name.trim()) return setError('Customer name is required.')
    setError(null)
    const { id: _id, created_at: _c, ...payload } = f as CustomerInput & { id?: string; created_at?: string }
    void _id
    void _c
    save.mutate({ ...payload, customer_name: f.customer_name.trim() }, { onError: (e) => setError(e.message) })
  }

  const v = (k: keyof CustomerInput) => (f[k] as string | null) ?? ''
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={customer ? 'Edit customer' : 'Add customer'}
      size="lg"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>Save customer</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Customer name" required className="sm:col-span-2">{(p) => <Input {...p} value={v('customer_name')} onChange={(e) => set('customer_name', e.target.value)} />}</FormField>
        <FormField label="Company">{(p) => <Input {...p} value={v('company_name')} onChange={(e) => set('company_name', e.target.value)} />}</FormField>
        <FormField label="GSTIN">{(p) => <Input {...p} value={v('gstin')} onChange={(e) => set('gstin', e.target.value)} />}</FormField>
        <FormField label="Phone" hint="Contact information only.">{(p) => <Input {...p} type="tel" value={v('phone')} onChange={(e) => set('phone', e.target.value)} />}</FormField>
        <FormField label="Alternate phone">{(p) => <Input {...p} type="tel" value={v('alternate_phone')} onChange={(e) => set('alternate_phone', e.target.value)} />}</FormField>
        <FormField label="Email" className="sm:col-span-2">{(p) => <Input {...p} type="email" value={v('email')} onChange={(e) => set('email', e.target.value)} />}</FormField>
        <FormField label="Billing address" className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={v('billing_address')} onChange={(e) => set('billing_address', e.target.value)} />}</FormField>
        <FormField label="City">{(p) => <Input {...p} value={v('city')} onChange={(e) => set('city', e.target.value)} />}</FormField>
        <FormField label="State">{(p) => <Input {...p} value={v('state')} onChange={(e) => set('state', e.target.value)} />}</FormField>
        <FormField label="Pincode">{(p) => <Input {...p} value={v('pincode')} onChange={(e) => set('pincode', e.target.value)} />}</FormField>
        <FormField label="Status">
          {(p) => (
            <Select {...p} value={f.status} onChange={(e) => setF((s) => ({ ...s, status: e.target.value as 'active' | 'inactive' }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          )}
        </FormField>
        <FormField label="Notes" className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={v('notes')} onChange={(e) => set('notes', e.target.value)} />}</FormField>
      </div>
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
    </Modal>
  )
}

export function CustomerList() {
  const { code } = useBusinessContext()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [adding, setAdding] = useState(false)
  const dq = useDebounce(q)
  const query = useBizQuery(['customers', 'list', dq, page], (c) => listCustomers(c, { q: dq, page }))

  const columns: Column<Customer>[] = [
    { key: 'name', header: 'Customer', sortValue: (c) => c.customer_name, cell: (c) => <span className="font-medium text-stone-900">{c.customer_name}</span> },
    { key: 'company', header: 'Company', cell: (c) => c.company_name ?? '—' },
    { key: 'phone', header: 'Phone', cell: (c) => c.phone ?? '—' },
    { key: 'city', header: 'City', cell: (c) => c.city ?? '—' },
    { key: 'gstin', header: 'GSTIN', cell: (c) => c.gstin ?? '—' },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge tone={c.status === 'active' ? 'success' : 'neutral'}>{c.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeader
        title="Customers"
        actions={
          <>
            <ExportCsvButton name="customers" columns={customerColumns} load={(c) => fetchAllPages((p) => listCustomers(c, { q: dq, page: p }))} />
            <WhenCan module="customers"><Button variant="accent" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add customer</Button></WhenCan>
          </>
        }
      />
      <Card>
        <FilterBar>
          <div className="w-full sm:w-72"><SearchBar value={q} onChange={(v) => { setQ(v); setPage(0) }} placeholder="Search name, phone, GSTIN" /></div>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={query.data?.rows}
          rowKey={(c) => c.id}
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          onRowClick={(c) => navigate(`/business/${code}/customers/${c.id}`)}
          empty={{ title: 'No customers yet', description: 'Add a customer to start billing.', action: <Button variant="primary" onClick={() => setAdding(true)}>Add customer</Button> }}
          pagination={{ page, pageSize: PAGE_SIZE, total: query.data?.total ?? 0, onPageChange: setPage }}
        />
      </Card>
      <CustomerFormDialog open={adding} onOpenChange={setAdding} onSaved={(id) => navigate(`/business/${code}/customers/${id}`)} />
    </div>
  )
}

export function CustomerDetail() {
  const { id } = useParams()
  const { code, can } = useBusinessContext()
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)
  const customer = useBizQuery(['customers', 'detail', id ?? ''], (c) => getCustomer(c, id!), { enabled: !!id })
  const bills = useBizQuery(['customers', 'bills', id ?? ''], (c) => listBills(c, { customerId: id, page: 0 }), { enabled: !!id })
  const quotes = useBizQuery(['customers', 'quotes', id ?? ''], (c) => listQuotations(c, { customerId: id, page: 0 }), { enabled: !!id })
  const pays = useBizQuery(['customers', 'payments', id ?? ''], (c) => listPayments(c, { customerId: id, page: 0 }), { enabled: !!id })
  const balance = useBizQuery(['ledger', 'balance', id ?? ''], (c) => ledgerBalance(c, id!), { enabled: !!id && can('ledger') })

  if (customer.isLoading) return <Skeleton className="h-96" />
  if (customer.error) return <ErrorState error={customer.error} onRetry={() => void customer.refetch()} />
  if (!customer.data) return null
  const c = customer.data
  const base = `/business/${code}`

  const dueOnBills = bills.data?.rows.filter((b) => b.status === 'active' && b.ledger_posted_at).reduce((s, b) => s + Number(b.balance_due), 0)

  return (
    <div>
      <PageHeader
        title={c.customer_name}
        crumbs={[{ label: 'Customers', to: `${base}/customers` }, { label: c.customer_name }]}
        description={[c.company_name, c.city].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <WhenCan module="customers"><Button onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button></WhenCan>
            <WhenCan module="payments"><Button variant="primary" onClick={() => setPaying(true)}><Wallet className="h-4 w-4" /> Record payment</Button></WhenCan>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {can('ledger') ? (
          <KpiCard label="Outstanding (ledger)" tone={balance.data && balance.data > 0 ? 'warning' : 'default'} loading={balance.isLoading} value={<CurrencyDisplay value={balance.data} />} hint="Latest running balance on the customer ledger" />
        ) : (
          <KpiCard label="Due on recent posted bills" loading={bills.isLoading} value={<CurrencyDisplay value={dueOnBills} />} hint="From the most recent bills" />
        )}
        <KpiCard label="Bills" loading={bills.isLoading} value={bills.data?.total ?? '—'} />
        <KpiCard label="Quotations" loading={quotes.isLoading} value={quotes.data?.total ?? '—'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="Contact & tax" />
          <dl className="space-y-2 p-5 text-sm">
            {[
              ['Phone', c.phone], ['Alternate phone', c.alternate_phone], ['Email', c.email], ['GSTIN', c.gstin],
              ['Billing address', c.billing_address], ['City', c.city], ['State', c.state], ['Pincode', c.pincode], ['Notes', c.notes],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="shrink-0 text-stone-500">{k}</dt><dd className="break-words text-right text-stone-900">{v || '—'}</dd></div>
            ))}
          </dl>
        </Card>
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Recent bills" actions={<Link className="text-xs text-amber-800 hover:underline" to={`${base}/bills`}>All bills</Link>} />
            <DataTable
              dense
              columns={[
                { key: 'no', header: 'Bill', cell: (b) => <Link className="font-medium text-amber-800 hover:underline" to={`${base}/bills/${b.id}`}>{b.bill_number}</Link> },
                { key: 'date', header: 'Date', cell: (b) => formatDate(b.bill_date) },
                { key: 'total', header: 'Total', numeric: true, cell: (b) => <CurrencyDisplay value={b.grand_total} /> },
                { key: 'due', header: 'Due', numeric: true, cell: (b) => <CurrencyDisplay value={b.balance_due} /> },
                { key: 'st', header: 'Status', cell: (b) => <BillStateBadge bill={b} /> },
              ]}
              rows={bills.data?.rows}
              rowKey={(b) => b.id}
              loading={bills.isLoading}
              error={bills.error}
              empty={{ title: 'No bills for this customer' }}
            />
          </Card>
          <Card>
            <CardHeader title="Payments received" />
            <DataTable
              dense
              columns={[
                { key: 'no', header: 'Payment', cell: (p) => p.payment_number },
                { key: 'date', header: 'Date', cell: (p) => formatDate(p.payment_date) },
                { key: 'bill', header: 'Against', cell: (p) => (p.bills ? p.bills.bill_number : 'On account') },
                { key: 'amt', header: 'Amount', numeric: true, cell: (p) => <CurrencyDisplay value={p.amount} /> },
              ]}
              rows={pays.data?.rows}
              rowKey={(p) => p.id}
              loading={pays.isLoading}
              error={pays.error}
              empty={{ title: 'No payments recorded' }}
            />
          </Card>
          <Card>
            <CardHeader title="Quotation history" />
            <DataTable
              dense
              columns={[
                { key: 'no', header: 'Quotation', cell: (q) => <Link className="font-medium text-amber-800 hover:underline" to={`${base}/quotations/${q.id}`}>{q.quotation_number}</Link> },
                { key: 'date', header: 'Date', cell: (q) => formatDate(q.quotation_date) },
                { key: 'total', header: 'Total', numeric: true, cell: (q) => <CurrencyDisplay value={q.grand_total} /> },
                { key: 'st', header: 'Status', cell: (q) => <QuotationStatusBadge status={q.status} /> },
              ]}
              rows={quotes.data?.rows}
              rowKey={(q) => q.id}
              loading={quotes.isLoading}
              error={quotes.error}
              empty={{ title: 'No quotations for this customer' }}
            />
          </Card>
        </div>
      </div>
      <CustomerFormDialog open={editing} onOpenChange={setEditing} customer={c} />
      <RecordPaymentDialog open={paying} onOpenChange={setPaying} customerId={c.id} />
    </div>
  )
}
