import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, CheckCircle2, Lock, Pencil, Trash2, Wallet } from 'lucide-react'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizMutation, useBizQuery } from '@/hooks/useBiz'
import { useStaffNames } from '@/hooks/useLookups'
import { cancelBill, deleteDraftBill, getBill, postBill } from '@/services/bills'
import { Card, CardHeader, CurrencyDisplay, PageHeader, PDFButton, PrintButton, QuantityDisplay } from '@/components/ui/layout'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { BillStateBadge, PaymentStatusBadge } from '@/components/ui/StatusBadge'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { BillDocument } from '@/components/documents/documents'
import RecordPaymentDialog from '@/features/payments/RecordPaymentDialog'
import { formatDate, formatDateTime, formatPercent, formatTime } from '@/lib/format'
import { billState } from '@/types/db'
import { cn } from '@/lib/utils'

export default function BillDetail() {
  const { id } = useParams()
  const { code, isAdmin, can } = useBusinessContext()
  const navigate = useNavigate()
  const [view, setView] = useState<'details' | 'document'>('details')
  const [dialog, setDialog] = useState<'post' | 'cancel' | 'delete' | 'pay' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const names = useStaffNames()
  const query = useBizQuery(['bills', 'detail', id ?? ''], (c) => getBill(c, id!), { enabled: !!id })
  const keys = [['bills'], ['dashboard'], ['alerts'], ['ledger'], ['payments'], ['customers']]

  const post = useBizMutation((c) => postBill(c, id!), { invalidate: keys, onSuccess: () => setDialog(null) })
  const cancel = useBizMutation((c, reason: string) => cancelBill(c, id!, reason), { invalidate: keys, onSuccess: () => setDialog(null) })
  const del = useBizMutation((c) => deleteDraftBill(c, id!), { invalidate: keys, onSuccess: () => navigate(`/business/${code}/bills`) })

  if (query.isLoading) return <Skeleton className="h-96" />
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Could not load this bill" />
  if (!query.data) return null

  const { bill, items, payments } = query.data
  const state = billState(bill)
  const isDraft = state === 'draft'
  const canEditBill = can('bills', 'edit')
  const canPay = state === 'posted' && bill.balance_due > 0 && can('payments', 'edit')
  const canCancel = isAdmin && state !== 'cancelled' && bill.amount_received === 0

  return (
    <div>
      <PageHeader
        title={`Bill ${bill.bill_number}`}
        crumbs={[{ label: 'Bills', to: `/business/${code}/bills` }, { label: bill.bill_number }]}
        description={`${bill.party_name || bill.customers?.customer_name || '—'} · ${formatDate(bill.bill_date)} · ${formatTime(bill.created_at)}`}
        actions={
          <>
            {view === 'document' && (
              <>
                <PrintButton />
                <PDFButton />
              </>
            )}
            {isDraft && canEditBill && (
              <Link to={`/business/${code}/bills/${bill.id}/edit`}>
                <Button>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              </Link>
            )}
            {isDraft && canEditBill && (
              <Button variant="accent" onClick={() => { setActionError(null); setDialog('post') }}>
                <CheckCircle2 className="h-4 w-4" /> Post to ledger
              </Button>
            )}
            {canPay && (
              <Button variant="primary" onClick={() => setDialog('pay')}>
                <Wallet className="h-4 w-4" /> Record payment
              </Button>
            )}
            {canCancel && (
              <Button variant="danger" onClick={() => { setActionError(null); setDialog('cancel') }}>
                <Ban className="h-4 w-4" /> Cancel bill
              </Button>
            )}
            {isAdmin && isDraft && (
              <Button onClick={() => { setActionError(null); setDialog('delete') }}>
                <Trash2 className="h-4 w-4" /> Delete draft
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-stone-200 no-print" role="tablist">
        {(['details', 'document'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-medium', view === v ? 'border-amber-500 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800')}
          >
            {v === 'details' ? 'Details' : 'Print view'}
          </button>
        ))}
      </div>

      {view === 'document' ? (
        <BillDocument bill={bill} items={items} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {state === 'posted' && (
              <Banner icon={<Lock className="h-4 w-4" />} tone="info">
                Posted on {formatDateTime(bill.ledger_posted_at)}. This bill is locked: its customer, number, date, lines and totals can no longer change. To correct it, an
                administrator can cancel it and issue a new bill.
              </Banner>
            )}
            {state === 'cancelled' && (
              <Banner icon={<Ban className="h-4 w-4" />} tone="danger">
                Cancelled on {formatDateTime(bill.cancelled_at)} by {bill.cancelled_by ? (names.data?.[bill.cancelled_by] ?? 'a user') : 'a user'}. Reason: {bill.cancellation_reason}. The bill number stays on record.
              </Banner>
            )}
            {isDraft && (
              <Banner tone="warning">This is a draft. It has not been posted to the customer ledger yet, and can still be edited.</Banner>
            )}

            <Card>
              <CardHeader title="Items" />
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                      <th className="px-5 py-2.5">Particulars</th>
                      <th className="px-3 py-2.5">HSN</th>
                      <th className="px-3 py-2.5 text-right">Pieces</th>
                      <th className="px-3 py-2.5 text-right">Rate</th>
                      <th className="px-5 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-stone-500">
                          No lines on this bill.
                        </td>
                      </tr>
                    )}
                    {items.map((it) => (
                      <tr key={it.id} className="border-t border-stone-100">
                        <td className="px-5 py-2.5 font-medium text-stone-900">{it.description}</td>
                        <td className="px-3 py-2.5">{it.hsn_code ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right">
                          <QuantityDisplay value={it.quantity} unit={it.unit} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <CurrencyDisplay value={it.rate} />
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <CurrencyDisplay value={it.amount} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHeader title="Payments received against this bill" />
              {payments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-stone-500">No payments recorded.</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div>
                        <p className="font-medium text-stone-900">{p.payment_number}</p>
                        <p className="text-xs text-stone-500">
                          {formatDate(p.payment_date)} · {p.payment_mode.replace('_', ' ')}
                          {p.reference_number ? ` · ${p.reference_number}` : ''}
                        </p>
                      </div>
                      <CurrencyDisplay value={p.amount} className="font-medium text-emerald-700" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Summary" />
              <dl className="space-y-2 p-5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-stone-500">Status</dt>
                  <dd className="flex items-center gap-2">
                    <BillStateBadge bill={bill} />
                  </dd>
                </div>
                <Row label="Taxable value" value={bill.subtotal} />
                {bill.discount_amount !== null && <Row label="Discount" value={bill.discount_amount} />}
                {bill.cgst_percent !== null && <Row label={`CGST ${formatPercent(bill.cgst_percent)}`} value={bill.cgst_amount} />}
                {bill.sgst_percent !== null && <Row label={`SGST ${formatPercent(bill.sgst_percent)}`} value={bill.sgst_amount} />}
                {bill.igst_percent !== null && <Row label={`IGST ${formatPercent(bill.igst_percent)}`} value={bill.igst_amount} />}
                {bill.other_charges !== null && <Row label="Other charges" value={bill.other_charges} />}
                <div className="flex items-center justify-between border-t border-stone-200 pt-2 text-base font-semibold text-stone-900">
                  <dt>Grand total</dt>
                  <dd>
                    <CurrencyDisplay value={bill.grand_total} />
                  </dd>
                </div>
                <Row label="Received" value={bill.amount_received} />
                <div className="flex items-center justify-between font-medium">
                  <dt className="text-stone-700">Balance due</dt>
                  <dd>
                    <CurrencyDisplay value={bill.balance_due} className={bill.balance_due > 0 ? 'text-amber-700' : ''} />
                  </dd>
                </div>
                {state !== 'cancelled' && (
                  <div className="flex items-center justify-between">
                    <dt className="text-stone-500">Payment</dt>
                    <dd>
                      <PaymentStatusBadge status={bill.payment_status} />
                    </dd>
                  </div>
                )}
              </dl>
            </Card>

            <Card>
              <CardHeader title="Document" />
              <dl className="space-y-2 p-5 text-sm">
                <Field label="Customer">
                  {bill.customers ? (
                    <Link className="text-amber-800 hover:underline" to={`/business/${code}/customers/${bill.customers.id}`}>
                      {bill.customers.customer_name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </Field>
                <Field label="Number source">{bill.bill_number_source === 'manual' ? 'Entered manually' : 'Generated'}</Field>
                <Field label="Party address">{bill.party_address ?? '—'}</Field>
                <Field label="Party GSTIN">{bill.party_gstin ?? '—'}</Field>
                <Field label="Vehicle no.">{bill.vehicle_number ?? '—'}</Field>
                <Field label="E-Way Bill no.">{bill.eway_bill_number ?? '—'}</Field>
                <Field label="Notes">{bill.notes ?? '—'}</Field>
              </dl>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={dialog === 'post'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Post this bill to the customer ledger?"
        description={<>This creates one ledger debit for the grand total and <strong>locks</strong> the bill. It cannot be undone except by cancelling the bill.</>}
        confirmLabel="Post bill"
        busy={post.isPending}
        error={actionError}
        onConfirm={() => post.mutate(undefined as never, { onError: (e) => setActionError(e.message) })}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Cancel this bill?"
        description="The bill stays on record and becomes read-only. If it was posted, the ledger debit is reversed. A bill with payments cannot be cancelled."
        confirmLabel="Cancel bill"
        tone="danger"
        reasonLabel="Reason for cancellation (required)"
        busy={cancel.isPending}
        error={actionError}
        onConfirm={(reason) => cancel.mutate(reason, { onError: (e) => setActionError(e.message) })}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Delete this draft?"
        description="Only an unposted draft can be deleted. The deletion is recorded in the audit log."
        confirmLabel="Delete draft"
        tone="danger"
        busy={del.isPending}
        error={actionError}
        onConfirm={() => del.mutate(undefined as never, { onError: (e) => setActionError(e.message) })}
      />
      <RecordPaymentDialog open={dialog === 'pay'} onOpenChange={(o) => !o && setDialog(null)} customerId={bill.customer_id} billId={bill.id} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd>
        <CurrencyDisplay value={value} />
      </dd>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-stone-500">{label}</dt>
      <dd className="break-words text-right text-stone-900">{children}</dd>
    </div>
  )
}

function Banner({ icon, tone, children }: { icon?: React.ReactNode; tone: 'info' | 'danger' | 'warning'; children: React.ReactNode }) {
  const cls = { info: 'bg-sky-50 text-sky-900 ring-sky-200', danger: 'bg-red-50 text-red-900 ring-red-200', warning: 'bg-amber-50 text-amber-900 ring-amber-200' }[tone]
  return (
    <div className={cn('flex gap-2.5 rounded-md px-4 py-3 text-sm ring-1', cls)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <p>{children}</p>
    </div>
  )
}
