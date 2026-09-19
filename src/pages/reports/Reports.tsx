import { useState, type ReactNode } from 'react'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizQuery } from '@/hooks/useBiz'
import { salesByDay } from '@/services/dashboard'
import { expenseSummary } from '@/services/finance'
import { listStock, listTrips } from '@/services/operations'
import { Card, DateRangePicker, PageHeader, PDFButton, PrintButton, QuantityDisplay } from '@/components/ui/layout'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Select } from '@/components/ui/form'
import { useBusinessLetterhead } from '@/hooks/useLookups'
import { daysAgoIST, formatDate, formatDateTime, formatINR, todayIST } from '@/lib/format'
import { DocumentPage } from '@/components/documents/documents'

type ReportId = 'daily' | 'monthly' | 'expenses' | 'outstanding' | 'stock' | 'trips' | 'profit'

const REPORTS: { id: ReportId; label: string }[] = [
  { id: 'daily', label: 'Daily sales' },
  { id: 'monthly', label: 'Monthly sales' },
  { id: 'expenses', label: 'Expenses by category' },
  { id: 'outstanding', label: 'Outstanding by customer' },
  { id: 'stock', label: 'Stock position' },
  { id: 'trips', label: 'Vehicles / trips' },
  { id: 'profit', label: 'Revenue / profit' },
]

const th = 'border-b border-slate-300 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500'
const td = 'border-b border-slate-100 px-3 py-2'

export default function Reports() {
  const { profile } = useBusinessContext()
  const lh = useBusinessLetterhead()
  const [report, setReport] = useState<ReportId>('daily')
  const [range, setRange] = useState({ from: daysAgoIST(29), to: todayIST() })
  const generated = formatDateTime(new Date().toISOString())
  const title = REPORTS.find((r) => r.id === report)!.label
  const usesRange = report !== 'outstanding' && report !== 'stock'

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Only figures the data can support are shown. Anything else says “Insufficient data”."
        actions={
          <>
            <PrintButton />
            <PDFButton />
          </>
        }
      />
      <Card className="no-print mb-6">
        <div className="flex flex-wrap items-end gap-4 p-5">
          <label className="block text-xs font-medium text-slate-600">
            Report
            <Select className="mt-1 w-64" value={report} onChange={(e) => setReport(e.target.value as ReportId)}>
              {REPORTS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </label>
          {usesRange && <DateRangePicker from={range.from} to={range.to} onChange={setRange} />}
        </div>
      </Card>

      <DocumentPage>
        <header className="border-b-2 border-slate-900 pb-3">
          <p className="text-lg font-bold">{lh.name || profile.name}</p>
          <p className="text-sm font-semibold uppercase tracking-wider">{title}</p>
          <p className="mt-1 text-xs text-slate-600">
            {usesRange ? `Period: ${formatDate(range.from)} to ${formatDate(range.to)}` : 'As of now'} · Business: {profile.name} · Generated: {generated}
          </p>
        </header>
        <div className="mt-4">
          {report === 'daily' && <DailySales from={range.from} to={range.to} mode="day" />}
          {report === 'monthly' && <DailySales from={range.from} to={range.to} mode="month" />}
          {report === 'expenses' && <ExpenseReport from={range.from} to={range.to} />}
          {report === 'outstanding' && <OutstandingReport />}
          {report === 'stock' && <StockReport />}
          {report === 'trips' && <TripReport from={range.from} to={range.to} />}
          {report === 'profit' && <Insufficient />}
        </div>
      </DocumentPage>
    </div>
  )
}

function State({ q, children }: { q: { isLoading: boolean; error: Error | null; refetch: () => unknown }; children: ReactNode }) {
  if (q.isLoading) return <Skeleton className="h-40" />
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />
  return <>{children}</>
}

function DailySales({ from, to, mode }: { from: string; to: string; mode: 'day' | 'month' }) {
  const q = useBizQuery(['reports', 'sales', from, to], (c) => salesByDay(c, from, to), { enabled: !!from && !!to })
  const rows =
    mode === 'day'
      ? (q.data ?? []).map((r) => ({ key: r.date, label: formatDate(r.date), total: r.total }))
      : [...(q.data ?? []).reduce((m, r) => m.set(r.date.slice(0, 7), (m.get(r.date.slice(0, 7)) ?? 0) + r.total), new Map<string, number>())].map(([k, total]) => ({ key: k, label: `${k.slice(5)}-${k.slice(0, 4)}`, total }))
  const sum = rows.reduce((s, r) => s + r.total, 0)
  return (
    <State q={q}>
      {rows.length === 0 ? (
        <EmptyState title="No sales in this period" />
      ) : (
        <table className="w-full text-sm">
          <thead><tr><th className={th}>{mode === 'day' ? 'Date' : 'Month'}</th><th className={`${th} text-right`}>Sales (active bills)</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.key}><td className={td}>{r.label}</td><td className={`${td} tabular text-right`}>{formatINR(r.total)}</td></tr>)}
            <tr className="font-semibold"><td className="px-3 py-2">Total</td><td className="tabular px-3 py-2 text-right">{formatINR(sum)}</td></tr>
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-slate-500">Counts every non-cancelled bill (draft or posted) by bill date.</p>
    </State>
  )
}

function ExpenseReport({ from, to }: { from: string; to: string }) {
  const q = useBizQuery(['reports', 'expenses', from, to], (c) => expenseSummary(c, { from, to }), { enabled: !!from && !!to })
  return (
    <State q={q}>
      {!q.data || q.data.count === 0 ? (
        <EmptyState title="No expenses in this period" />
      ) : (
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Category</th><th className={`${th} text-right`}>Amount</th></tr></thead>
          <tbody>
            {q.data.byCategory.map(([cat, total]) => <tr key={cat}><td className={`${td} capitalize`}>{cat}</td><td className={`${td} tabular text-right`}>{formatINR(total)}</td></tr>)}
            <tr className="font-semibold"><td className="px-3 py-2">Total ({q.data.count})</td><td className="tabular px-3 py-2 text-right">{formatINR(q.data.total)}</td></tr>
          </tbody>
        </table>
      )}
    </State>
  )
}

function OutstandingReport() {
  const q = useBizQuery(['reports', 'outstanding'], async (c) => {
    const res = await c.from('bills').select('customer_id, balance_due, customers(customer_name)').eq('status', 'active').not('ledger_posted_at', 'is', null).gt('balance_due', 0).limit(20000)
    if (res.error) throw new Error(res.error.message)
    const map = new Map<string, { name: string; due: number; bills: number }>()
    for (const r of (res.data ?? []) as unknown as { customer_id: string; balance_due: number; customers: { customer_name: string } | null }[]) {
      const cur = map.get(r.customer_id) ?? { name: r.customers?.customer_name ?? '—', due: 0, bills: 0 }
      cur.due += Number(r.balance_due)
      cur.bills += 1
      map.set(r.customer_id, cur)
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.due - a.due)
  })
  const total = q.data?.reduce((s, r) => s + r.due, 0) ?? 0
  return (
    <State q={q}>
      {!q.data || q.data.length === 0 ? (
        <EmptyState title="Nothing outstanding" description="No posted bill has a balance due." />
      ) : (
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Customer</th><th className={`${th} text-right`}>Open bills</th><th className={`${th} text-right`}>Balance due</th></tr></thead>
          <tbody>
            {q.data.map((r) => <tr key={r.id}><td className={td}>{r.name}</td><td className={`${td} tabular text-right`}>{r.bills}</td><td className={`${td} tabular text-right`}>{formatINR(r.due)}</td></tr>)}
            <tr className="font-semibold"><td className="px-3 py-2" colSpan={2}>Total</td><td className="tabular px-3 py-2 text-right">{formatINR(total)}</td></tr>
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-slate-500">Balance due on posted, non-cancelled bills. Opening balances and on-account payments are on the customer ledger.</p>
    </State>
  )
}

function StockReport() {
  const q = useBizQuery(['reports', 'stock'], (c) => listStock(c, {}))
  return (
    <State q={q}>
      {!q.data || q.data.length === 0 ? (
        <EmptyState title="No stock items" />
      ) : (
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Material</th><th className={th}>Batch</th><th className={`${th} text-right`}>Opening</th><th className={`${th} text-right`}>Received</th><th className={`${th} text-right`}>Used / sold</th><th className={`${th} text-right`}>Adjust.</th><th className={`${th} text-right`}>Current</th></tr></thead>
          <tbody>
            {q.data.map((r) => (
              <tr key={r.stock_item_id}>
                <td className={td}>{r.materials?.name ?? '—'}</td><td className={td}>{r.batch_code ?? '—'}</td>
                <td className={`${td} text-right`}><QuantityDisplay value={r.opening_quantity} unit={r.unit} /></td>
                <td className={`${td} text-right`}><QuantityDisplay value={r.received_quantity} unit={r.unit} /></td>
                <td className={`${td} text-right`}><QuantityDisplay value={r.used_quantity} unit={r.unit} /></td>
                <td className={`${td} text-right`}><QuantityDisplay value={r.adjustment_quantity} unit={r.unit} /></td>
                <td className={`${td} text-right font-semibold`}><QuantityDisplay value={r.current_quantity} unit={r.unit} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </State>
  )
}

function TripReport({ from, to }: { from: string; to: string }) {
  const q = useBizQuery(['reports', 'trips', from, to], async (c) => {
    const page = await listTrips(c, { from, to, page: 0 })
    return page
  }, { enabled: !!from && !!to })
  const counts = new Map<string, number>()
  q.data?.rows.forEach((t) => counts.set(t.status, (counts.get(t.status) ?? 0) + 1))
  return (
    <State q={q}>
      {!q.data || q.data.total === 0 ? (
        <EmptyState title="No trips in this period" />
      ) : (
        <>
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Status</th><th className={`${th} text-right`}>Trips</th></tr></thead>
            <tbody>{[...counts.entries()].map(([s, n]) => <tr key={s}><td className={`${td} capitalize`}>{s.replace('_', ' ')}</td><td className={`${td} tabular text-right`}>{n}</td></tr>)}</tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">Showing the {q.data.rows.length} most recent of {q.data.total} trips in the period.</p>
        </>
      )}
    </State>
  )
}

function Insufficient() {
  return (
    <div className="rounded-md bg-slate-50 p-5 ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-900">Insufficient data</p>
      <p className="mt-1 text-sm text-slate-600">
        Profit cannot be calculated accurately: stock movements carry no cost, so the cost of goods sold is unknown. Revenue is available under Daily / Monthly sales and
        expenses under Expenses by category; subtracting them would not be a true profit, so no figure is shown.
      </p>
      <p className="mt-3 text-xs text-slate-500">Revenue this period and expenses are shown separately on their own reports.</p>
    </div>
  )
}
