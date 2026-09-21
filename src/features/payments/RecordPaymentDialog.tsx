import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/form'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { useBizMutation, useBizQuery } from '@/hooks/useBiz'
import { useCustomerPicker } from '@/hooks/useLookups'
import { openBillsForCustomer, recordPayment } from '@/services/finance'
import { formatDate, formatINR, todayIST } from '@/lib/format'
import type { PaymentMode } from '@/types/db'

const MODES: { value: PaymentMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
]

/**
 * Records a payment RECEIVED FROM A CUSTOMER through record_payment(). The
 * database takes the customer from the bill, refuses a bill that is not posted
 * or a payment above the balance due, and (via the idempotency key) turns an
 * accidental double-submit into the same single payment.
 */
export default function RecordPaymentDialog({
  open,
  onOpenChange,
  customerId: presetCustomer,
  billId: presetBill,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  customerId?: string
  billId?: string
}) {
  const customers = useCustomerPicker()
  const [customerId, setCustomerId] = useState(presetCustomer ?? '')
  const [billId, setBillId] = useState(presetBill ?? '')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<PaymentMode>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(todayIST())
  const [error, setError] = useState<string | null>(null)
  const key = useRef(crypto.randomUUID())

  useEffect(() => {
    if (open) {
      key.current = crypto.randomUUID()
      setCustomerId(presetCustomer ?? '')
      setBillId(presetBill ?? '')
      setAmount('')
      setReference('')
      setNotes('')
      setDate(todayIST())
      setError(null)
    }
  }, [open, presetCustomer, presetBill])

  const bills = useBizQuery(['payments', 'open-bills', customerId], (c) => openBillsForCustomer(c, customerId), { enabled: !!customerId && open })
  const selected = bills.data?.find((b) => b.id === billId)

  useEffect(() => {
    if (selected && !amount) setAmount(String(selected.balance_due))
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useBizMutation(recordPayment, {
    invalidate: [['bills'], ['payments'], ['ledger'], ['dashboard'], ['customers'], ['alerts']],
    onSuccess: () => onOpenChange(false),
  })

  function submit() {
    const n = Number(amount)
    if (!customerId && !billId) return setError('Choose a customer.')
    if (!Number.isFinite(n) || n <= 0) return setError('Enter an amount greater than zero.')
    if (selected && n > selected.balance_due) return setError(`Amount exceeds the balance due (${formatINR(selected.balance_due)}) on this bill.`)
    setError(null)
    mutation.mutate(
      { customerId: customerId || null, billId: billId || null, amount: n, mode, reference: reference.trim() || null, notes: notes.trim() || null, date, idempotencyKey: key.current },
      { onError: (e) => setError(e.message) },
    )
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record customer payment"
      description="Money received from a customer. It is posted to the customer ledger automatically."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={mutation.isPending} onClick={submit}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-stone-600">
            Customer <span className="text-red-600">*</span>
          </label>
          <SearchableSelect
            value={customerId}
            disabled={!!presetCustomer || !!presetBill}
            onChange={(val) => {
              setCustomerId(val)
              setBillId('')
              setAmount('')
            }}
            placeholder="Search or select customer…"
            options={(customers.data ?? []).map((c) => ({
              value: c.id,
              label: c.customer_name,
              sublabel: c.gstin ? `GST: ${c.gstin}` : c.billing_address || undefined,
            }))}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-stone-600">
            Against bill (optional)
            <span className="ml-1 text-[11px] font-normal text-stone-400">
              Only posted bills with a balance. Leave blank for on-account.
            </span>
          </label>
          <SearchableSelect
            value={billId}
            disabled={!customerId || !!presetBill}
            onChange={(val) => {
              setBillId(val)
              setAmount('')
            }}
            placeholder="On account (no bill)"
            options={[
              { value: '', label: 'On account (no specific bill)' },
              ...(bills.data ?? []).map((b) => ({
                value: b.id,
                label: `Bill ${b.bill_number}`,
                sublabel: `${formatDate(b.bill_date)} · Balance Due: ${formatINR(b.balance_due)}`,
              })),
            ]}
          />
        </div>
        <FormField label="Amount (₹)" required>
          {(p) => <Input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </FormField>
        <FormField label="Payment date" required>
          {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </FormField>
        <FormField label="Mode" required>
          {(p) => (
            <Select {...p} value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Reference no. (cheque / UTR)">{(p) => <Input {...p} value={reference} onChange={(e) => setReference(e.target.value)} />}</FormField>
        <FormField label="Notes" className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </FormField>
      </div>
      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </Modal>
  )
}
