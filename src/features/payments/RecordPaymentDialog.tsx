import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/form'
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
        <FormField label="Customer" required className="sm:col-span-2">
          {(p) => (
            <Select {...p} value={customerId} disabled={!!presetCustomer || !!presetBill} onChange={(e) => { setCustomerId(e.target.value); setBillId(''); setAmount('') }}>
              <option value="">Select customer…</option>
              {customers.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Against bill (optional)" hint="Only posted bills with a balance are listed. Leave blank for an on-account payment." className="sm:col-span-2">
          {(p) => (
            <Select {...p} value={billId} disabled={!customerId || !!presetBill} onChange={(e) => { setBillId(e.target.value); setAmount('') }}>
              <option value="">On account (no bill)</option>
              {bills.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bill_type === 'ev' ? 'EV' : 'Normal'} {b.bill_number} · {formatDate(b.bill_date)} · due {formatINR(b.balance_due)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
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
