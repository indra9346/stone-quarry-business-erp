import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizQuery } from '@/hooks/useBiz'
import { useDebounce } from '@/hooks/useDebounce'
import { listQuotations, type QuotationRow } from '@/services/documents'
import { PAGE_SIZE } from '@/services/common'
import { Card, CurrencyDisplay, DateRangePicker, FilterBar, PageHeader, SearchBar } from '@/components/ui/layout'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { QuotationStatusBadge } from '@/components/ui/StatusBadge'
import { Select } from '@/components/ui/form'
import { formatDate } from '@/lib/format'
import type { QuotationStatus } from '@/types/db'

export default function QuotationList() {
  const { code } = useBusinessContext()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<QuotationStatus | ''>('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [page, setPage] = useState(0)
  const dq = useDebounce(q)
  const base = `/business/${code}/quotations`

  const query = useBizQuery(['quotations', 'list', dq, status, range.from, range.to, page], (c) =>
    listQuotations(c, { q: dq, status: status || undefined, from: range.from || undefined, to: range.to || undefined, page }),
  )

  const columns: Column<QuotationRow>[] = [
    { key: 'no', header: 'Quotation no.', sortValue: (r) => r.quotation_number, cell: (r) => <span className="font-medium text-stone-900">{r.quotation_number}</span> },
    { key: 'customer', header: 'Customer', sortValue: (r) => r.customers?.customer_name ?? null, cell: (r) => r.customers?.customer_name ?? '—' },
    { key: 'date', header: 'Date', sortValue: (r) => r.quotation_date, cell: (r) => formatDate(r.quotation_date) },
    { key: 'valid', header: 'Valid until', cell: (r) => formatDate(r.valid_until) },
    { key: 'total', header: 'Total', numeric: true, sortValue: (r) => r.grand_total, cell: (r) => <CurrencyDisplay value={r.grand_total} /> },
    { key: 'status', header: 'Status', cell: (r) => <QuotationStatusBadge status={r.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Provisional module — numbering, expiry and tax handling follow the current defaults until the business confirms them."
        actions={
          <Link to={`${base}/new`} className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-semibold text-navy-950 hover:bg-amber-400">
            <Plus className="h-4 w-4" /> New quotation
          </Link>
        }
      />
      <Card>
        <FilterBar>
          <div className="w-full sm:w-64">
            <SearchBar value={q} onChange={(v) => { setQ(v); setPage(0) }} placeholder="Search by quotation number" />
          </div>
          <label className="block text-xs font-medium text-stone-600">
            Status
            <Select className="mt-1 w-36" value={status} onChange={(e) => { setStatus(e.target.value as QuotationStatus | ''); setPage(0) }}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </Select>
          </label>
          <DateRangePicker from={range.from} to={range.to} onChange={(r) => { setRange(r); setPage(0) }} />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={query.data?.rows}
          rowKey={(r) => r.id}
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          onRowClick={(r) => navigate(`${base}/${r.id}`)}
          empty={{ title: 'No quotations found', description: 'Create a quotation to see it here.' }}
          pagination={{ page, pageSize: PAGE_SIZE, total: query.data?.total ?? 0, onPageChange: setPage }}
        />
      </Card>
    </div>
  )
}
