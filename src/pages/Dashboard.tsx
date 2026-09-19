import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Banknote, Boxes, FileText, Receipt, Truck, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizQuery } from '@/hooks/useBiz'
import { useAlerts } from '@/hooks/useAlerts'
import { loadKpis, recentActivity, salesByDay } from '@/services/dashboard'
import { Card, CardHeader, CurrencyDisplay, DateRangePicker, KpiCard, PageHeader } from '@/components/ui/layout'
import { BillStateBadge, QuotationStatusBadge, StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { daysAgoIST, formatDate, formatINR, todayIST } from '@/lib/format'

export default function Dashboard() {
  const { code, profile, fullName } = useBusinessContext()
  const today = todayIST()
  const [range, setRange] = useState({ from: daysAgoIST(13), to: today })
  const base = `/business/${code}`

  const kpis = useBizQuery(['dashboard', 'kpis', today], (c) => loadKpis(c, today))
  const sales = useBizQuery(['dashboard', 'sales', range.from, range.to], (c) => salesByDay(c, range.from, range.to), {
    enabled: !!range.from && !!range.to,
  })
  const recent = useBizQuery(['dashboard', 'recent'], (c) => recentActivity(c))
  const alerts = useAlerts()

  const k = kpis.data
  const chartTotal = sales.data?.reduce((s, r) => s + r.total, 0) ?? 0

  return (
    <div>
      <PageHeader
        title={`Good day${fullName ? `, ${fullName.split(' ')[0]}` : ''}`}
        description={`${profile.name} — business overview for ${formatDate(today)}`}
        actions={
          <>
            <Link to={`${base}/bills/new?type=normal`} className="rounded-md bg-navy-800 px-3.5 py-2 text-sm font-medium text-white hover:bg-navy-700">
              New Normal Bill
            </Link>
            <Link to={`${base}/bills/new?type=ev`} className="rounded-md bg-amber-500 px-3.5 py-2 text-sm font-semibold text-navy-950 hover:bg-amber-400">
              New EV Bill
            </Link>
          </>
        }
      />

      {kpis.error && <ErrorState error={kpis.error} onRetry={() => void kpis.refetch()} title="Could not load key figures" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Today's sales"
          icon={<Receipt className="h-5 w-5" />}
          loading={kpis.isLoading}
          value={<CurrencyDisplay value={k?.salesToday} />}
          hint={k ? `${k.billsToday} active bill${k.billsToday === 1 ? '' : 's'} dated today (draft or posted)` : undefined}
        />
        <KpiCard
          label="Outstanding amount"
          icon={<Banknote className="h-5 w-5" />}
          loading={kpis.isLoading}
          tone={k && k.outstanding > 0 ? 'warning' : 'default'}
          value={<CurrencyDisplay value={k?.outstanding} />}
          hint={k ? `Balance due on ${k.openBills} posted bill${k.openBills === 1 ? '' : 's'}` : undefined}
        />
        <KpiCard
          label="Payments received today"
          icon={<Wallet className="h-5 w-5" />}
          loading={kpis.isLoading}
          tone="success"
          value={<CurrencyDisplay value={k?.paymentsToday} />}
          hint="Customer payments dated today"
        />
        <KpiCard
          label="Stock items"
          icon={<Boxes className="h-5 w-5" />}
          loading={kpis.isLoading}
          value={k?.stockItems ?? '—'}
          hint={k ? `${k.stockEmpty} at zero · quantities are not summed across units` : undefined}
        />
        <KpiCard
          label="Active vehicles"
          icon={<Truck className="h-5 w-5" />}
          loading={kpis.isLoading}
          value={k?.vehiclesActive ?? '—'}
          hint={k ? `${k.vehiclesOnTrip} currently on a trip` : undefined}
        />
        <KpiCard
          label="Pending quotations"
          icon={<FileText className="h-5 w-5" />}
          loading={kpis.isLoading}
          value={k?.pendingQuotations ?? '—'}
          hint="Draft or sent"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="overflow-hidden rounded-lg bg-navy-900 shadow-card ring-1 ring-white/5 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Sales activity</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Active bills per day · total <span className="tabular text-amber-400">{formatINR(chartTotal)}</span>
              </p>
            </div>
            <div className="[&_input]:!bg-navy-800 [&_input]:!text-slate-100 [&_input]:!ring-white/10 [&_label]:!text-slate-400">
              <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
            </div>
          </div>
          <div className="h-72 px-2 py-4">
            {sales.isLoading ? (
              <Skeleton className="mx-3 h-full !bg-white/5" />
            ) : sales.error ? (
              <ErrorState error={sales.error} onRetry={() => void sales.refetch()} />
            ) : !sales.data || sales.data.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No bills in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sales.data.map((d) => ({ ...d, label: formatDate(d.date).slice(0, 5) }))}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={11} width={60} tickFormatter={(v: number) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
                    formatter={(v: number) => [formatINR(v), 'Sales']}
                    labelFormatter={(_l, p) => formatDate(p[0]?.payload?.date as string | undefined)}
                  />
                  <Bar dataKey="total" fill="#e8a227" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <Card>
          <CardHeader title="Alerts" description="Derived from live data" />
          <div className="p-2">
            {alerts.items.length === 0 ? (
              <EmptyState className="py-8" title="All clear" description="Nothing needs attention right now." />
            ) : (
              alerts.items.map((a) => (
                <Link key={a.id} to={`${base}/${a.to}`} className="flex items-start gap-2.5 rounded-md p-3 text-sm text-slate-700 hover:bg-slate-50">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  {a.message}
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent bills" actions={<Link to={`${base}/bills`} className="text-xs text-cyan-700 hover:underline">View all</Link>} />
          <RecentList loading={recent.isLoading} error={recent.error} empty="No bills yet.">
            {recent.data?.bills.map((b) => (
              <Row key={b.id} to={`${base}/bills/${b.id}`} title={`${b.bill_type === 'ev' ? 'EV' : 'Normal'} · ${b.bill_number}`} sub={`${b.customers?.customer_name ?? '—'} · ${formatDate(b.bill_date)}`}>
                <CurrencyDisplay value={b.grand_total} className="text-sm font-medium" />
                <BillStateBadge bill={b} />
              </Row>
            ))}
          </RecentList>
        </Card>

        <Card>
          <CardHeader title="Recent quotations" actions={<Link to={`${base}/quotations`} className="text-xs text-cyan-700 hover:underline">View all</Link>} />
          <RecentList loading={recent.isLoading} error={recent.error} empty="No quotations yet.">
            {recent.data?.quotations.map((q) => (
              <Row key={q.id} to={`${base}/quotations/${q.id}`} title={q.quotation_number} sub={`${q.customers?.customer_name ?? '—'} · ${formatDate(q.quotation_date)}`}>
                <CurrencyDisplay value={q.grand_total} className="text-sm font-medium" />
                <QuotationStatusBadge status={q.status} />
              </Row>
            ))}
          </RecentList>
        </Card>

        <Card>
          <CardHeader title="Payment activity" actions={<Link to={`${base}/payments`} className="text-xs text-cyan-700 hover:underline">View all</Link>} />
          <RecentList loading={recent.isLoading} error={recent.error} empty="No payments recorded yet.">
            {recent.data?.payments.map((p) => (
              <Row key={p.id} to={`${base}/payments`} title={p.payment_number} sub={`${p.customers?.customer_name ?? '—'} · ${formatDate(p.payment_date)}`}>
                <CurrencyDisplay value={p.amount} className="text-sm font-medium text-emerald-700" />
              </Row>
            ))}
          </RecentList>
        </Card>

        <Card>
          <CardHeader title="Vehicles & trips" actions={<Link to={`${base}/trips`} className="text-xs text-cyan-700 hover:underline">View all</Link>} />
          <RecentList loading={recent.isLoading} error={recent.error} empty="No trips yet.">
            {recent.data?.trips.map((t) => (
              <Row key={t.id} to={`${base}/trips`} title={`${t.trip_number} · ${t.vehicles?.registration_number ?? '—'}`} sub={`${t.destination ?? 'No destination'} · ${formatDate(t.trip_date)}`}>
                <StatusBadge tone={t.status === 'delivered' ? 'success' : t.status === 'cancelled' ? 'danger' : 'info'}>{t.status.replace('_', ' ')}</StatusBadge>
              </Row>
            ))}
          </RecentList>
        </Card>
      </div>
    </div>
  )
}

function RecentList({ loading, error, empty, children }: { loading: boolean; error: unknown; empty: string; children: React.ReactNode }) {
  if (loading) {
    return (
      <div className="space-y-3 p-5">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
    )
  }
  if (error) return <ErrorState error={error} title="Could not load" />
  const items = Array.isArray(children) ? children : [children]
  if (items.filter(Boolean).length === 0) return <EmptyState className="py-10" title={empty} />
  return <ul className="divide-y divide-slate-100">{children}</ul>
}

function Row({ to, title, sub, children }: { to: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{title}</p>
          <p className="truncate text-xs text-slate-500">{sub}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">{children}</div>
      </Link>
    </li>
  )
}
