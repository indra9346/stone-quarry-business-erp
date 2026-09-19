import { useState } from 'react'
import { useBizQuery } from '@/hooks/useBiz'
import { useStaffNames } from '@/hooks/useLookups'
import { listAudit } from '@/services/catalog'
import { PAGE_SIZE } from '@/services/common'
import { Card, DateRangePicker, FilterBar, PageHeader } from '@/components/ui/layout'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/form'
import { StatusBadge, type Tone } from '@/components/ui/StatusBadge'
import { formatDateTime } from '@/lib/format'
import type { AuditLog } from '@/types/db'

const MODULES = [
  'bills', 'bill_items', 'payments', 'customer_ledger', 'quotations', 'quotation_items', 'customers', 'stock_items', 'stock_movements',
  'expenses', 'vehicles', 'drivers', 'trips', 'materials', 'units', 'settings', 'staff_profiles', 'measurement_sheets', 'measurement_sheet_rows',
]
const tone: Record<AuditLog['action'], Tone> = { INSERT: 'success', UPDATE: 'info', DELETE: 'danger' }

/** Read-only audit trail. The database writes these rows; nothing here can change them. */
export default function AuditLogs() {
  const [module, setModule] = useState('')
  const [action, setAction] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<AuditLog | null>(null)
  const names = useStaffNames()
  const query = useBizQuery(['audit', module, action, range.from, range.to, page], (c) =>
    listAudit(c, { module: module || undefined, action: action || undefined, from: range.from || undefined, to: range.to || undefined, page }),
  )
  const columns: Column<AuditLog>[] = [
    { key: 'ts', header: 'When', cell: (a) => formatDateTime(a.created_at) },
    { key: 'user', header: 'User', cell: (a) => (a.actor_id ? (names.data?.[a.actor_id] ?? 'Unknown user') : 'System') },
    { key: 'act', header: 'Action', cell: (a) => <StatusBadge tone={tone[a.action]}>{a.action}</StatusBadge> },
    { key: 'mod', header: 'Entity', cell: (a) => a.module.replace(/_/g, ' ') },
    { key: 'rec', header: 'Record', className: 'font-mono text-xs', cell: (a) => a.record_id?.slice(0, 8) ?? '—' },
    { key: 'd', header: '', cell: (a) => <Button size="sm" onClick={() => setOpen(a)}>Details</Button> },
  ]
  return (
    <div>
      <PageHeader title="Audit logs" description="A read-only record of every change, written by the database. It cannot be edited or deleted." />
      <Card>
        <FilterBar>
          <label className="block text-xs font-medium text-slate-600">Entity
            <Select className="mt-1 w-48" value={module} onChange={(e) => { setModule(e.target.value); setPage(0) }}>
              <option value="">All</option>{MODULES.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
            </Select>
          </label>
          <label className="block text-xs font-medium text-slate-600">Action
            <Select className="mt-1 w-36" value={action} onChange={(e) => { setAction(e.target.value); setPage(0) }}>
              <option value="">All</option><option value="INSERT">Insert</option><option value="UPDATE">Update</option><option value="DELETE">Delete</option>
            </Select>
          </label>
          <DateRangePicker from={range.from} to={range.to} onChange={(r) => { setRange(r); setPage(0) }} />
        </FilterBar>
        <DataTable columns={columns} rows={query.data?.rows} rowKey={(a) => a.id} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}
          empty={{ title: 'No audit entries', description: 'Entries appear as soon as records are created or changed.' }}
          pagination={{ page, pageSize: PAGE_SIZE, total: query.data?.total ?? 0, onPageChange: setPage }} />
      </Card>
      <Modal open={open !== null} onOpenChange={(o) => !o && setOpen(null)} size="xl" title={open ? `${open.action} · ${open.module.replace(/_/g, ' ')}` : ''} description={open ? formatDateTime(open.created_at) : undefined}>
        {open && (
          <div className="grid gap-4 md:grid-cols-2">
            <div><p className="mb-1 text-xs font-semibold uppercase text-slate-500">Before</p><pre className="max-h-96 overflow-auto rounded-md bg-slate-50 p-3 text-xs">{open.previous_values ? JSON.stringify(open.previous_values, null, 2) : '—'}</pre></div>
            <div><p className="mb-1 text-xs font-semibold uppercase text-slate-500">After</p><pre className="max-h-96 overflow-auto rounded-md bg-slate-50 p-3 text-xs">{open.new_values ? JSON.stringify(open.new_values, null, 2) : '—'}</pre></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
