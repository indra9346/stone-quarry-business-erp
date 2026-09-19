import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Printer, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatINR, formatQuantity } from '@/lib/format'
import { Button } from './Button'
import { Input } from './form'
import { Skeleton } from './feedback'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-lg bg-white shadow-card ring-1 ring-slate-200/70', className)}>{children}</section>
}

export function CardHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
}: {
  title: string
  description?: string
  actions?: ReactNode
  crumbs?: { label: string; to?: string }[]
}) {
  return (
    <div className="mb-6 animate-fade-up">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1 text-xs text-slate-500">
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {c.to ? (
                <Link to={c.to} className="hover:text-slate-800">
                  {c.label}
                </Link>
              ) : (
                <span className="text-slate-700">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

const kpiTone = {
  default: 'text-slate-900',
  warning: 'text-amber-600',
  danger: 'text-red-600',
  success: 'text-emerald-600',
} as const

export function KpiCard({
  label,
  value,
  hint,
  icon,
  loading,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
  loading?: boolean
  tone?: keyof typeof kpiTone
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg bg-white p-4 shadow-card ring-1 ring-slate-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-500/70 via-cyan-500/60 to-transparent" />
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="text-slate-300 transition-colors group-hover:text-cyan-500">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-28" />
      ) : (
        <p className={cn('tabular mt-2 text-2xl font-semibold tracking-tight', kpiTone[tone])}>{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

/** ₹ amount in Indian format; NULL shows "—" (never ₹0.00). */
export function CurrencyDisplay({ value, className, muted }: { value: number | string | null | undefined; className?: string; muted?: boolean }) {
  return <span className={cn('tabular', muted && value == null && 'text-slate-400', className)}>{formatINR(value)}</span>
}

/** A quantity exactly as stored (Indian grouping), with the stored unit — none assumed. */
export function QuantityDisplay({ value, unit, className }: { value: number | string | null | undefined; unit?: string | null; className?: string }) {
  return (
    <span className={cn('tabular', className)}>
      {formatQuantity(value)}
      {value != null && unit ? <span className="ml-1 text-slate-500">{unit}</span> : null}
    </span>
  )
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
    </div>
  )
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-3.5">{children}</div>
}

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}) {
  return (
    <div className="flex items-end gap-2">
      <label className="block text-xs font-medium text-slate-600">
        From
        <Input type="date" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} className="mt-1 w-36" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        To
        <Input type="date" value={to} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} className="mt-1 w-36" />
      </label>
    </div>
  )
}

/** Opens the browser print dialog for the `.print-area` element. */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <Button onClick={() => window.print()} className="no-print">
      <Printer className="h-4 w-4" />
      {label}
    </Button>
  )
}

/** PDFs are produced by the browser: choose "Save as PDF" in the print dialog. */
export function PDFButton() {
  return (
    <Button onClick={() => window.print()} className="no-print" title='In the print dialog, choose "Save as PDF"'>
      <Printer className="h-4 w-4" />
      Save as PDF
    </Button>
  )
}
