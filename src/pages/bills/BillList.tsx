import { useState } from 'react'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { fetchAllPages } from '@/lib/csv'
import { billColumns } from '@/lib/exportColumns'
import { WhenCan } from '@/features/auth/WhenCan'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizQuery } from '@/hooks/useBiz'
import { useDebounce } from '@/hooks/useDebounce'
import { listBills, PAGE_SIZE, type BillRow } from '@/services/bills'
import { Card, CurrencyDisplay, DateRangePicker, FilterBar, PageHeader, SearchBar } from '@/components/ui/layout'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { BillStateBadge, PaymentStatusBadge } from '@/components/ui/StatusBadge'
import { Select } from '@/components/ui/form'
import { formatDate, formatTime } from '@/lib/format'
import type { BillState } from '@/types/db'

export default function BillList() {
  const { code } = useBusinessContext()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [state, setState] = useState<BillState | 'all'>('all')
  const [range, setRange] = useState({ from: '', to: '' })
  const [page, setPage] = useState(0)
  const dq = useDebounce(q)
  const base = `/business/${code}/bills`

  const query = useBizQuery(['bills', 'list', 'all', dq, state, range.from, range.to, page], (c) =>
    listBills(c, { q: dq, state, from: range.from || undefined, to: range.to || undefined, page }),
  )

  const columns: Column<BillRow>[] = [
    { key: 'number', header: 'Bill no.', sortValue: (b) => b.bill_number, cell: (b) => <span className="font-medium text-stone-900">{b.bill_number}</span> },
    { key: 'date', header: 'Date', sortValue: (b) => b.bill_date, cell: (b) => <>{formatDate(b.bill_date)} <span className="ml-1.5 text-xs text-stone-400">{formatTime(b.created_at)}</span></> },
    { key: 'customer', header: 'Customer', sortValue: (b) => b.customers?.customer_name ?? null, cell: (b) => b.party_name || b.customers?.customer_name || '—' },
    { key: 'total', header: 'Total', numeric: true, sortValue: (b) => b.grand_total, cell: (b) => <CurrencyDisplay value={b.grand_total} /> },
    { key: 'balance', header: 'Balance due', numeric: true, sortValue: (b) => b.balance_due, cell: (b) => <CurrencyDisplay value={b.balance_due} /> },
    { key: 'pay', header: 'Payment', cell: (b) => (b.status === 'cancelled' ? '—' : <PaymentStatusBadge status={b.payment_status} />) },
    { key: 'state', header: 'Status', cell: (b) => <BillStateBadge bill={b} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Bills"
        description="Draft bills can be edited; posted bills are locked; cancelled bills stay on record."
        actions={
          <>
            <ExportCsvButton
              name="bills"
              columns={billColumns}
              load={(c) => fetchAllPages((p) => listBills(c, { q: dq, state, from: range.from || undefined, to: range.to || undefined, page: p }))}
            />
            <WhenCan module="bills">
              <Link to={`${base}/new`} className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-bold text-slate-900 hover:bg-amber-400 shadow-sm">
                <Plus className="h-4 w-4" /> New bill
              </Link>
            </WhenCan>
          </>
        }
      />
      <Card>
        <FilterBar>
          <div className="w-full sm:w-64">
            <SearchBar value={q} onChange={(v) => { setQ(v); setPage(0) }} placeholder="Search by bill number" />
          </div>
          <label className="block text-xs font-medium text-stone-600">
            Status
            <Select className="mt-1 w-36" value={state} onChange={(e) => { setState(e.target.value as BillState | 'all'); setPage(0) }}>
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </label>
          <DateRangePicker from={range.from} to={range.to} onChange={(r) => { setRange(r); setPage(0) }} />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={query.data?.rows}
          rowKey={(b) => b.id}
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          onRowClick={(b) => navigate(`${base}/${b.id}`)}
          empty={{ title: 'No bills found', description: q || state !== 'all' || range.from ? 'Try changing the filters.' : 'Create the first bill to see it here.' }}
          pagination={{ page, pageSize: PAGE_SIZE, total: query.data?.total ?? 0, onPageChange: setPage }}
        />
      </Card>
    </div>
  )
}
