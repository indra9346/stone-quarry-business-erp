import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatDate, formatINR, formatPercent, formatQuantity } from '@/lib/format'
import { useBusinessLetterhead } from '@/hooks/useLookups'
import type { Bill, BillItem, MeasurementRow, MeasurementSheet, Quotation, QuotationItem } from '@/types/db'
import { billState } from '@/types/db'

/** A4-style sheet. Only this element prints (see `.print-area` in index.css). */
export function DocumentPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('print-area mx-auto w-full max-w-[794px] bg-white p-8 text-[13px] leading-relaxed text-stone-900 shadow-card ring-1 ring-stone-200 print:p-0 print:shadow-none', className)}>
      {children}
    </div>
  )
}

/** Business letterhead — every value comes from the business's own settings. */
export function DocumentHeader({ title, number, date }: { title: string; number?: string | null; date?: string | null }) {
  const lh = useBusinessLetterhead()
  return (
    <header className="border-b-2 border-stone-900 pb-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-bold tracking-wide">{lh.name}</p>
          {lh.address && <p className="mt-0.5 max-w-md text-xs text-stone-600">{lh.address}</p>}
          <p className="mt-0.5 text-xs text-stone-600">
            {[lh.phone && `Phone: ${lh.phone}`, lh.email, lh.gstin && `GSTIN: ${lh.gstin}`].filter(Boolean).join('  ·  ')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold uppercase tracking-widest">{title}</p>
          {number && <p className="mt-1 text-xs">No. <span className="font-semibold">{number}</span></p>}
          {date && <p className="text-xs">Date: <span className="font-semibold">{formatDate(date)}</span></p>}
        </div>
      </div>
    </header>
  )
}

/** Large diagonal status stamp for non-final documents. */
export function DocumentStatus({ label, tone = 'red' }: { label: string; tone?: 'red' | 'amber' }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute left-1/2 top-40 -transtone-x-1/2 -rotate-12 select-none rounded border-4 px-6 py-2 text-5xl font-black uppercase tracking-widest opacity-15',
        tone === 'red' ? 'border-red-600 text-red-600' : 'border-amber-600 text-amber-600',
      )}
    >
      {label}
    </div>
  )
}

function Kv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-24 shrink-0 text-stone-500">{label}</span>
      <span className="font-medium">{children ?? '—'}</span>
    </div>
  )
}

const th = 'border border-stone-400 bg-stone-100 px-2 py-1.5 text-left text-[11px] font-semibold uppercase'
const td = 'border border-stone-300 px-2 py-1.5 align-top'

function Signatures({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-14 grid grid-cols-2 gap-10 text-xs">
      <div className="border-t border-stone-500 pt-1.5">{left}</div>
      <div className="border-t border-stone-500 pt-1.5 text-right">{right}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ bill */
export function BillDocument({
  bill,
  items,
}: {
  bill: Bill & { customers: { customer_name: string; gstin: string | null; billing_address: string | null } | null }
  items: BillItem[]
}) {
  const lh = useBusinessLetterhead()
  const state = billState(bill)
  const partyName = bill.party_name || bill.customers?.customer_name
  return (
    <DocumentPage className="relative">
      {state === 'cancelled' && <DocumentStatus label="Cancelled" />}
      {state === 'draft' && <DocumentStatus label="Draft" tone="amber" />}
      <DocumentHeader title={bill.bill_type === 'ev' ? 'EV Bill' : 'Bill'} number={bill.bill_number} date={bill.bill_date} />

      <div className="mt-4 grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <Kv label="Party">{partyName}</Kv>
          <Kv label="Address">{bill.party_address || bill.customers?.billing_address}</Kv>
          <Kv label="GSTIN">{bill.party_gstin || bill.customers?.gstin}</Kv>
        </div>
        <div className="space-y-1">
          <Kv label="Bill type">{bill.bill_type === 'ev' ? 'EV Bill' : 'Normal Bill'}</Kv>
          <Kv label="Vehicle No.">{bill.vehicle_number}</Kv>
          <Kv label="E-Way Bill No.">{bill.eway_bill_number}</Kv>
        </div>
      </div>

      <table className="mt-5 w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={cn(th, 'w-10')}>Sl.</th>
            <th className={th}>Particulars</th>
            <th className={cn(th, 'w-20')}>HSN</th>
            <th className={cn(th, 'w-24 text-right')}>Qty</th>
            <th className={cn(th, 'w-24 text-right')}>Rate</th>
            <th className={cn(th, 'w-28 text-right')}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id}>
              <td className={td}>{i + 1}</td>
              <td className={td}>{it.description}</td>
              <td className={td}>{it.hsn_code ?? ''}</td>
              <td className={cn(td, 'tabular text-right')}>
                {it.quantity === null ? '' : formatQuantity(it.quantity)} {it.quantity !== null && it.unit ? it.unit : ''}
              </td>
              <td className={cn(td, 'tabular text-right')}>{it.rate === null ? '' : formatINR(it.rate)}</td>
              <td className={cn(td, 'tabular text-right')}>{it.amount === null ? '' : formatINR(it.amount)}</td>
            </tr>
          ))}
          {items.length < 6 &&
            Array.from({ length: 6 - items.length }, (_, i) => (
              <tr key={`pad-${i}`} aria-hidden>
                <td className={td}>&nbsp;</td>
                <td className={td} />
                <td className={td} />
                <td className={td} />
                <td className={td} />
                <td className={td} />
              </tr>
            ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-end">
        <table className="w-72 text-xs">
          <tbody>
            <TotalRow label="Total (taxable value)" value={bill.subtotal} />
            {bill.discount_amount !== null && <TotalRow label="Discount" value={bill.discount_amount} />}
            {bill.cgst_percent !== null && <TotalRow label={`CGST ${formatPercent(bill.cgst_percent)}`} value={bill.cgst_amount} />}
            {bill.sgst_percent !== null && <TotalRow label={`SGST ${formatPercent(bill.sgst_percent)}`} value={bill.sgst_amount} />}
            {bill.igst_percent !== null && <TotalRow label={`IGST ${formatPercent(bill.igst_percent)}`} value={bill.igst_amount} />}
            {bill.other_charges !== null && <TotalRow label="Other charges" value={bill.other_charges} />}
            <TotalRow label="Grand total" value={bill.grand_total} strong />
          </tbody>
        </table>
      </div>

      {bill.notes && <p className="mt-4 text-xs text-stone-600">Notes: {bill.notes}</p>}
      <Signatures left="Receiver signature" right={`For ${lh.name}`} />
    </DocumentPage>
  )
}

function TotalRow({ label, value, strong }: { label: string; value: number | null; strong?: boolean }) {
  return (
    <tr className={cn(strong && 'border-t-2 border-stone-900 text-sm font-bold')}>
      <td className="py-1 pr-3">{label}</td>
      <td className="tabular py-1 text-right">{formatINR(value)}</td>
    </tr>
  )
}

/* ------------------------------------------------------------- quotation */
export function QuotationDocument({
  quotation,
  items,
}: {
  quotation: Quotation & { customers: { customer_name: string; gstin: string | null; billing_address: string | null } | null }
  items: QuotationItem[]
}) {
  const lh = useBusinessLetterhead()
  return (
    <DocumentPage className="relative">
      {quotation.status === 'draft' && <DocumentStatus label="Draft" tone="amber" />}
      {quotation.status === 'rejected' && <DocumentStatus label="Rejected" />}
      <DocumentHeader title="Quotation" number={quotation.quotation_number} date={quotation.quotation_date} />
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <Kv label="To">{quotation.customers?.customer_name}</Kv>
          <Kv label="Address">{quotation.customers?.billing_address}</Kv>
          <Kv label="GSTIN">{quotation.customers?.gstin}</Kv>
        </div>
        <div className="space-y-1">
          <Kv label="Valid until">{quotation.valid_until ? formatDate(quotation.valid_until) : null}</Kv>
        </div>
      </div>
      <table className="mt-5 w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={cn(th, 'w-10')}>Sl.</th>
            <th className={th}>Particulars</th>
            <th className={cn(th, 'w-20')}>HSN</th>
            <th className={cn(th, 'w-24 text-right')}>Qty</th>
            <th className={cn(th, 'w-24 text-right')}>Rate</th>
            <th className={cn(th, 'w-28 text-right')}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id}>
              <td className={td}>{i + 1}</td>
              <td className={td}>{it.description}</td>
              <td className={td}>{it.hsn_code ?? ''}</td>
              <td className={cn(td, 'tabular text-right')}>
                {it.quantity === null ? '' : formatQuantity(it.quantity)} {it.quantity !== null && it.unit ? it.unit : ''}
              </td>
              <td className={cn(td, 'tabular text-right')}>{it.rate === null ? '' : formatINR(it.rate)}</td>
              <td className={cn(td, 'tabular text-right')}>{it.amount === null ? '' : formatINR(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-end">
        <table className="w-72 text-xs">
          <tbody>
            <TotalRow label="Subtotal" value={quotation.subtotal} />
            <TotalRow label="Discount" value={quotation.discount_amount} />
            <TotalRow label="Tax" value={quotation.tax_amount} />
            <TotalRow label="Other charges" value={quotation.other_charges} />
            <TotalRow label="Total" value={quotation.grand_total} strong />
          </tbody>
        </table>
      </div>
      {quotation.terms && <p className="mt-4 whitespace-pre-line text-xs text-stone-600">Terms: {quotation.terms}</p>}
      {quotation.notes && <p className="mt-2 whitespace-pre-line text-xs text-stone-600">Notes: {quotation.notes}</p>}
      <Signatures left="Customer acceptance" right={`For ${lh.name}`} />
    </DocumentPage>
  )
}

/* --------------------------------------------------------------- measurement */
export function MeasurementDocument({
  sheet,
  rows,
}: {
  sheet: MeasurementSheet & { customers: { customer_name: string } | null }
  rows: MeasurementRow[]
}) {
  const lh = useBusinessLetterhead()
  return (
    <DocumentPage>
      <DocumentHeader title="Measurement Sheet" number={sheet.sheet_number} date={sheet.sheet_date} />
      <div className="mt-4 space-y-1">
        <Kv label="To">{sheet.party_name_text || sheet.customers?.customer_name}</Kv>
      </div>
      <table className="mt-5 w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={cn(th, 'w-10')}>Sl.</th>
            <th className={th}>Particulars (measurement)</th>
            <th className={cn(th, 'w-20')}>PCS</th>
            <th className={cn(th, 'w-24 text-right')}>Qty</th>
            <th className={cn(th, 'w-24 text-right')}>Rate</th>
            <th className={cn(th, 'w-28 text-right')}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={td}>{r.row_no}</td>
              <td className={td}>{r.measurement_text}</td>
              <td className={td}>{r.pcs_text ?? ''}</td>
              <td className={cn(td, 'tabular text-right')}>{r.quantity === null ? '' : formatQuantity(r.quantity)}</td>
              <td className={cn(td, 'tabular text-right')}>{r.rate === null ? '' : formatINR(r.rate)}</td>
              <td className={cn(td, 'tabular text-right')}>{r.amount === null ? '' : formatINR(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-end">
        <table className="w-72 text-xs">
          <tbody>
            <TotalRow label="Total (as written)" value={sheet.stated_total} strong />
          </tbody>
        </table>
      </div>
      {sheet.notes && <p className="mt-4 text-xs text-stone-600">Notes: {sheet.notes}</p>}
      <Signatures left="Receiver signature" right={`For ${lh.name}`} />
    </DocumentPage>
  )
}
