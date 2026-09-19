import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Bill, BillState, QuotationStatus } from '@/types/db'
import { billState } from '@/types/db'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  info: 'bg-cyan-50 text-cyan-800 ring-cyan-600/20',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  danger: 'bg-red-50 text-red-800 ring-red-600/20',
  accent: 'bg-navy-800 text-amber-400 ring-white/10',
}

export function StatusBadge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const stateTone: Record<BillState, Tone> = { draft: 'warning', posted: 'success', cancelled: 'danger' }
const stateLabel: Record<BillState, string> = { draft: 'Draft', posted: 'Posted', cancelled: 'Cancelled' }

export function BillStateBadge({ bill }: { bill: Pick<Bill, 'status' | 'ledger_posted_at'> }) {
  const s = billState(bill)
  return <StatusBadge tone={stateTone[s]}>{stateLabel[s]}</StatusBadge>
}

const payTone: Record<Bill['payment_status'], Tone> = {
  unpaid: 'neutral',
  partially_paid: 'warning',
  paid: 'success',
  overpaid: 'info',
}
const payLabel: Record<Bill['payment_status'], string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Part paid',
  paid: 'Paid',
  overpaid: 'Overpaid',
}

export function PaymentStatusBadge({ status }: { status: Bill['payment_status'] }) {
  return <StatusBadge tone={payTone[status]}>{payLabel[status]}</StatusBadge>
}

const qTone: Record<QuotationStatus, Tone> = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'success',
  rejected: 'danger',
  expired: 'warning',
  converted: 'accent',
}

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return <StatusBadge tone={qTone[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</StatusBadge>
}

export function BillTypeBadge({ type }: { type: Bill['bill_type'] }) {
  return <StatusBadge tone={type === 'ev' ? 'accent' : 'neutral'}>{type === 'ev' ? 'EV Bill' : 'Normal Bill'}</StatusBadge>
}
