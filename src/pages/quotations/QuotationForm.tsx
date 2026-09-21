import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizMutation, useBizQuery } from '@/hooks/useBiz'
import { useCustomerPicker, usePrefix, useUnits } from '@/hooks/useLookups'
import { generateNumber } from '@/services/bills'
import { createQuotation, getQuotation, quotationTotals, updateQuotation, type QuotationInput } from '@/services/documents'
import { Card, CardHeader, PageHeader } from '@/components/ui/layout'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/form'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import LineItemsEditor from '@/features/documents/LineItemsEditor'
import { draftsToInputs, newLine, rowsToDrafts, type LineDraft } from '@/features/documents/lines'
import { formatINR, parseOptionalNumber, todayIST } from '@/lib/format'
import type { QuotationStatus } from '@/types/db'

const num = (s: string) => {
  const n = parseOptionalNumber(s)
  return n === null ? 0 : n
}

export default function QuotationForm({ mode }: { mode: 'create' | 'edit' }) {
  const { code } = useBusinessContext()
  const { id } = useParams()
  const navigate = useNavigate()
  const units = useUnits()
  const customers = useCustomerPicker()
  const prefix = usePrefix('quotation')
  const existing = useBizQuery(['quotations', 'detail', id ?? ''], (c) => getQuotation(c, id!), { enabled: mode === 'edit' && !!id })

  const [numberMode, setNumberMode] = useState<'manual' | 'generated'>('generated')
  const [number, setNumber] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [date, setDate] = useState(todayIST())
  const [validUntil, setValidUntil] = useState('')
  const [status, setStatus] = useState<QuotationStatus>('draft')
  const [discount, setDiscount] = useState('')
  const [tax, setTax] = useState('')
  const [other, setOther] = useState('')
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([newLine()])
  const [errors, setErrors] = useState<string[]>([])
  const [loaded, setLoaded] = useState(mode === 'create')

  useEffect(() => {
    const d = existing.data
    if (!d || loaded) return
    const q = d.quotation
    setNumberMode('manual')
    setNumber(q.quotation_number)
    setCustomerId(q.customer_id)
    setDate(q.quotation_date)
    setValidUntil(q.valid_until ?? '')
    setStatus(q.status)
    setDiscount(q.discount_amount ? String(q.discount_amount) : '')
    setTax(q.tax_amount ? String(q.tax_amount) : '')
    setOther(q.other_charges ? String(q.other_charges) : '')
    setNotes(q.notes ?? '')
    setTerms(q.terms ?? '')
    setLines(d.items.length ? rowsToDrafts(d.items) : [newLine()])
    setLoaded(true)
  }, [existing.data, loaded])

  const totals = useMemo(() => {
    const { items } = draftsToInputs(lines)
    return quotationTotals({ items, discount_amount: num(discount), tax_amount: num(tax), other_charges: num(other) })
  }, [lines, discount, tax, other])

  const save = useBizMutation(
    async (c, input: QuotationInput) => {
      if (mode === 'edit' && id) {
        await updateQuotation(c, id, input)
        return id
      }
      return (await createQuotation(c, input)).id
    },
    { invalidate: [['quotations'], ['dashboard']], onSuccess: (qid) => navigate(`/business/${code}/quotations/${qid}`) },
  )
  const generate = useBizMutation((c, p: string) => generateNumber(c, 'quotation', p))

  async function submit() {
    const errs: string[] = []
    if (!customerId) errs.push('Choose a customer.')
    if (numberMode === 'manual' && !number.trim()) errs.push('Enter the quotation number.')
    const { items, errors: lineErrors } = draftsToInputs(lines)
    errs.push(...lineErrors)
    for (const [label, v] of [['Discount', discount], ['Tax', tax], ['Other charges', other]] as const) {
      const n = parseOptionalNumber(v)
      if (n !== null && (Number.isNaN(n) || n < 0)) errs.push(`${label} must be a number ≥ 0 (or blank).`)
    }
    if (totals.grand_total < 0) errs.push('The discount is larger than the total.')
    if (errs.length) return setErrors(errs)
    setErrors([])

    let quotationNumber = number.trim()
    try {
      if (numberMode === 'generated') quotationNumber = await generate.mutateAsync(prefix)
    } catch (e) {
      return setErrors([e instanceof Error ? e.message : 'Could not generate a number.'])
    }
    save.mutate(
      {
        quotation_number: quotationNumber,
        customer_id: customerId,
        quotation_date: date,
        valid_until: validUntil || null,
        status,
        discount_amount: num(discount),
        tax_amount: num(tax),
        other_charges: num(other),
        notes: notes.trim() || null,
        terms: terms.trim() || null,
        items,
      },
      { onError: (e) => setErrors([e.message]) },
    )
  }

  if (mode === 'edit') {
    if (existing.isLoading) return <Skeleton className="h-96" />
    if (existing.error) return <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
  }
  const busy = save.isPending || generate.isPending

  return (
    <div>
      <PageHeader
        title={mode === 'edit' ? 'Edit quotation' : 'New quotation'}
        crumbs={[{ label: 'Quotations', to: `/business/${code}/quotations` }, { label: mode === 'edit' ? 'Edit' : 'New' }]}
        actions={
          <>
            <Button onClick={() => navigate(-1)} disabled={busy}>Cancel</Button>
            <Button variant="accent" loading={busy} onClick={() => void submit()}>Save quotation</Button>
          </>
        }
      />
      {errors.length > 0 && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200" role="alert">
          <ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Quotation details" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-stone-600">Quotation number *</span>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="qnum" checked={numberMode === 'generated'} disabled={mode === 'edit'} onChange={() => setNumberMode('generated')} />
                    Generate next number
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="qnum" checked={numberMode === 'manual'} onChange={() => setNumberMode('manual')} />
                    Enter number
                  </label>
                </div>
                {numberMode === 'manual' ? (
                  <Input className="mt-2 max-w-xs" aria-label="Quotation number" value={number} onChange={(e) => setNumber(e.target.value)} />
                ) : (
                  <p className="mt-2 text-xs text-stone-500">A number with prefix “{prefix}” is issued on save. The business's own format is not confirmed yet.</p>
                )}
              </div>
              <FormField label="Customer" required className="sm:col-span-2">
                {(p) => (
                  <Select {...p} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">Select customer…</option>
                    {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
                  </Select>
                )}
              </FormField>
              <FormField label="Date" required>{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</FormField>
              <FormField label="Valid until (optional)">{(p) => <Input {...p} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />}</FormField>
              <FormField label="Status">
                {(p) => (
                  <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as QuotationStatus)}>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                )}
              </FormField>
            </div>
          </Card>
          <Card>
            <CardHeader title="Items" description="A line with only a description is allowed. Enter quantity and rate together." />
            <div className="p-5"><LineItemsEditor lines={lines} onChange={setLines} units={units.data ?? []} /></div>
          </Card>
          <Card>
            <CardHeader title="Terms & notes" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <FormField label="Terms">{(p) => <Textarea {...p} value={terms} onChange={(e) => setTerms(e.target.value)} />}</FormField>
              <FormField label="Notes">{(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} />}</FormField>
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Adjustments" description="Amounts in ₹. Tax is entered as an amount — the business's quotation tax rules are not defined yet." />
            <div className="grid gap-4 p-5">
              <FormField label="Discount">{(p) => <Input {...p} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />}</FormField>
              <FormField label="Tax">{(p) => <Input {...p} inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />}</FormField>
              <FormField label="Other charges">{(p) => <Input {...p} inputMode="decimal" value={other} onChange={(e) => setOther(e.target.value)} />}</FormField>
            </div>
          </Card>
          <section className="rounded-xl border border-stone-200 bg-white p-5 text-stone-800 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Totals</h2>
            <dl className="tabular mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-stone-500">Subtotal</dt><dd className="font-medium text-slate-800">{formatINR(totals.subtotal)}</dd></div>
              <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold text-amber-700"><dt>Total</dt><dd>{formatINR(totals.grand_total)}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}
