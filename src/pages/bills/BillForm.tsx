import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizMutation, useBizQuery } from '@/hooks/useBiz'
import { useCustomerPicker, usePrefix, useUnits, useVehiclePicker } from '@/hooks/useLookups'
import { createBill, generateNumber, getBill, lineAmount, updateBill, type BillInput } from '@/services/bills'
import { Card, CardHeader, PageHeader } from '@/components/ui/layout'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/form'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import LineItemsEditor from '@/features/documents/LineItemsEditor'
import { draftsToInputs, newLine, rowsToDrafts, type LineDraft } from '@/features/documents/lines'
import { formatINR, parseOptionalNumber, round2, todayIST } from '@/lib/format'
import { billState, type BillType } from '@/types/db'

const optNum = (s: string) => {
  const n = parseOptionalNumber(s)
  return n
}

/** Create / edit a DRAFT bill. Posted and cancelled bills are read-only (enforced by the database). */
export default function BillForm({ mode }: { mode: 'create' | 'edit' }) {
  const { code } = useBusinessContext()
  const { id } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const units = useUnits()
  const customers = useCustomerPicker()
  const vehicles = useVehiclePicker()
  const evPrefix = usePrefix('ev_bill')
  const normalPrefix = usePrefix('normal_bill')

  const existing = useBizQuery(['bills', 'detail', id ?? ''], (c) => getBill(c, id!), { enabled: mode === 'edit' && !!id })

  const [type, setType] = useState<BillType>(search.get('type') === 'ev' ? 'ev' : 'normal')
  const typeParam = search.get('type')
  useEffect(() => {
    if (mode === 'create') setType(typeParam === 'ev' ? 'ev' : 'normal')
  }, [mode, typeParam])
  const [numberMode, setNumberMode] = useState<'manual' | 'generated'>('manual')
  const [number, setNumber] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [date, setDate] = useState(todayIST())
  const [partyName, setPartyName] = useState('')
  const [partyAddress, setPartyAddress] = useState('')
  const [partyGstin, setPartyGstin] = useState('')
  const [eway, setEway] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [cgst, setCgst] = useState('')
  const [sgst, setSgst] = useState('')
  const [igst, setIgst] = useState('')
  const [discount, setDiscount] = useState('')
  const [other, setOther] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([newLine()])
  const [errors, setErrors] = useState<string[]>([])
  const [loaded, setLoaded] = useState(mode === 'create')

  useEffect(() => {
    const d = existing.data
    if (!d || loaded) return
    const b = d.bill
    setType(b.bill_type)
    setNumberMode(b.bill_number_source)
    setNumber(b.bill_number)
    setCustomerId(b.customer_id)
    setDate(b.bill_date)
    setPartyName(b.party_name ?? '')
    setPartyAddress(b.party_address ?? '')
    setPartyGstin(b.party_gstin ?? '')
    setEway(b.eway_bill_number ?? '')
    setVehicleNumber(b.vehicle_number ?? '')
    setVehicleId(b.vehicle_id ?? '')
    setCgst(b.cgst_percent === null ? '' : String(b.cgst_percent))
    setSgst(b.sgst_percent === null ? '' : String(b.sgst_percent))
    setIgst(b.igst_percent === null ? '' : String(b.igst_percent))
    setDiscount(b.discount_amount === null ? '' : String(b.discount_amount))
    setOther(b.other_charges === null ? '' : String(b.other_charges))
    setNotes(b.notes ?? '')
    setLines(d.items.length ? rowsToDrafts(d.items) : [newLine()])
    setLoaded(true)
  }, [existing.data, loaded])

  // Live preview only — the database recomputes and owns the real totals.
  const preview = useMemo(() => {
    const { items } = draftsToInputs(lines)
    const subtotal = round2(items.reduce((s, i) => s + (lineAmount(i) ?? 0), 0))
    const d = optNum(discount)
    const taxable = round2(subtotal - (d && !Number.isNaN(d) ? d : 0))
    const tax = (p: string) => {
      const n = optNum(p)
      return n === null || Number.isNaN(n) ? null : round2((taxable * n) / 100)
    }
    const c = tax(cgst)
    const s = tax(sgst)
    const i = tax(igst)
    const o = optNum(other)
    return { subtotal, taxable, cgst: c, sgst: s, igst: i, total: round2(taxable + (c ?? 0) + (s ?? 0) + (i ?? 0) + (o && !Number.isNaN(o) ? o : 0)) }
  }, [lines, discount, cgst, sgst, igst, other])

  const save = useBizMutation(
    async (c, input: BillInput) => {
      if (mode === 'edit' && id) {
        await updateBill(c, id, input)
        return id
      }
      const bill = await createBill(c, input)
      return bill.id
    },
    { invalidate: [['bills'], ['dashboard'], ['alerts']], onSuccess: (billId) => navigate(`/business/${code}/bills/${billId}`) },
  )
  const generate = useBizMutation((c, t: BillType) => generateNumber(c, t === 'ev' ? 'ev_bill' : 'normal_bill', t === 'ev' ? evPrefix : normalPrefix))

  async function submit() {
    const errs: string[] = []
    if (!customerId) errs.push('Choose a customer.')
    if (numberMode === 'manual' && !number.trim()) errs.push('Enter the bill number (or choose "Generate next number").')
    const { items, errors: lineErrors } = draftsToInputs(lines)
    errs.push(...lineErrors)
    for (const [label, v] of [['CGST %', cgst], ['SGST %', sgst], ['IGST %', igst], ['Discount', discount], ['Other charges', other]] as const) {
      const n = optNum(v)
      if (n !== null && (Number.isNaN(n) || n < 0)) errs.push(`${label} must be a number ≥ 0 (or left blank).`)
    }
    if (errs.length) return setErrors(errs)
    setErrors([])

    let billNumber = number.trim()
    try {
      if (numberMode === 'generated' && !(mode === 'edit' && existing.data?.bill.bill_number_source === 'generated')) {
        billNumber = await generate.mutateAsync(type)
      }
    } catch (e) {
      return setErrors([e instanceof Error ? e.message : 'Could not generate a number.'])
    }

    const input: BillInput = {
      bill_type: type,
      bill_number: billNumber,
      bill_number_source: numberMode,
      customer_id: customerId,
      bill_date: date,
      party_name: partyName.trim() || null,
      party_address: partyAddress.trim() || null,
      party_gstin: partyGstin.trim() || null,
      eway_bill_number: eway.trim() || null,
      vehicle_number: vehicleNumber.trim() || null,
      vehicle_id: vehicleId || null,
      cgst_percent: optNum(cgst),
      sgst_percent: optNum(sgst),
      igst_percent: optNum(igst),
      discount_amount: optNum(discount),
      other_charges: optNum(other),
      notes: notes.trim() || null,
      items,
    }
    save.mutate(input, { onError: (e) => setErrors([e.message]) })
  }

  if (mode === 'edit') {
    if (existing.isLoading) return <Skeleton className="h-96" />
    if (existing.error) return <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
    if (existing.data && billState(existing.data.bill) !== 'draft') {
      return (
        <ErrorState
          title="This bill can no longer be edited"
          error="Posted and cancelled bills are locked. Cancel the bill (admin) and issue a corrected one if needed."
        />
      )
    }
  }

  const busy = save.isPending || generate.isPending

  return (
    <div>
      <PageHeader
        title={mode === 'edit' ? 'Edit draft bill' : type === 'ev' ? 'New EV bill' : 'New Normal bill'}
        crumbs={[{ label: 'Bills', to: `/business/${code}/bills` }, { label: mode === 'edit' ? 'Edit' : 'New' }]}
        actions={
          <>
            <Button onClick={() => navigate(-1)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="accent" loading={busy} onClick={() => void submit()}>
              Save draft
            </Button>
          </>
        }
      />

      {errors.length > 0 && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200" role="alert">
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Bill details" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <FormField label="Bill type" required>
                {(p) => (
                  <Select {...p} value={type} onChange={(e) => setType(e.target.value as BillType)}>
                    <option value="normal">Normal Bill</option>
                    <option value="ev">EV Bill</option>
                  </Select>
                )}
              </FormField>
              <FormField label="Bill date" required>
                {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
              </FormField>

              <div className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-stone-600">
                  Bill number <span className="text-red-600">*</span>
                </span>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="numberMode" checked={numberMode === 'manual'} onChange={() => setNumberMode('manual')} />
                    Enter existing number
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="numberMode" checked={numberMode === 'generated'} onChange={() => setNumberMode('generated')} />
                    Generate next number
                  </label>
                </div>
                {numberMode === 'manual' ? (
                  <Input className="mt-2 max-w-xs" aria-label="Bill number" placeholder="e.g. the number printed on the physical bill" value={number} onChange={(e) => setNumber(e.target.value)} />
                ) : (
                  <p className="mt-2 text-xs text-stone-500">
                    {mode === 'edit' && existing.data?.bill.bill_number_source === 'generated'
                      ? `Keeping ${number}.`
                      : `A number with prefix “${type === 'ev' ? evPrefix : normalPrefix}” will be issued when you save.`}
                  </p>
                )}
                <p className="mt-1 text-xs text-stone-500">Numbers are unique per bill type: Normal 52 and EV 52 can both exist.</p>
              </div>

              <FormField label="Customer" required className="sm:col-span-2">
                {(p) => (
                  <Select
                    {...p}
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value)
                      const c = customers.data?.find((x) => x.id === e.target.value)
                      if (c && !partyName) setPartyName(c.customer_name)
                      if (c && !partyAddress) setPartyAddress(c.billing_address ?? '')
                      if (c && !partyGstin) setPartyGstin(c.gstin ?? '')
                    }}
                  >
                    <option value="">Select customer…</option>
                    {customers.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customer_name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Party name (as on the bill)">{(p) => <Input {...p} value={partyName} onChange={(e) => setPartyName(e.target.value)} />}</FormField>
              <FormField label="Party GSTIN">{(p) => <Input {...p} value={partyGstin} onChange={(e) => setPartyGstin(e.target.value)} />}</FormField>
              <FormField label="Party address" className="sm:col-span-2">
                {(p) => <Textarea {...p} rows={2} value={partyAddress} onChange={(e) => setPartyAddress(e.target.value)} />}
              </FormField>
            </div>
          </Card>

          <Card>
            <CardHeader title="Transport" description="Optional." />
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <FormField label="Vehicle number (as written)">{(p) => <Input {...p} value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />}</FormField>
              <FormField label="Vehicle (from master)">
                {(p) => (
                  <Select {...p} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                    <option value="">—</option>
                    {vehicles.data?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registration_number}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="E-Way Bill no.">{(p) => <Input {...p} value={eway} onChange={(e) => setEway(e.target.value)} />}</FormField>
            </div>
          </Card>

          <Card>
            <CardHeader title="Items" description="A line with only a description is allowed. Enter quantity and rate together." />
            <div className="p-5">
              <LineItemsEditor lines={lines} onChange={setLines} units={units.data ?? []} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Tax & charges" description="Leave blank when not applicable — blank is stored as “not used”, not 0." />
            <div className="grid grid-cols-3 gap-3 p-5">
              <FormField label="CGST %">{(p) => <Input {...p} inputMode="decimal" value={cgst} onChange={(e) => setCgst(e.target.value)} />}</FormField>
              <FormField label="SGST %">{(p) => <Input {...p} inputMode="decimal" value={sgst} onChange={(e) => setSgst(e.target.value)} />}</FormField>
              <FormField label="IGST %">{(p) => <Input {...p} inputMode="decimal" value={igst} onChange={(e) => setIgst(e.target.value)} />}</FormField>
              <FormField label="Discount (₹)" className="col-span-3 sm:col-span-1">{(p) => <Input {...p} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />}</FormField>
              <FormField label="Other charges (₹)" className="col-span-3 sm:col-span-2">{(p) => <Input {...p} inputMode="decimal" value={other} onChange={(e) => setOther(e.target.value)} />}</FormField>
            </div>
          </Card>

          <section className="rounded-xl border border-stone-200 bg-white p-5 text-stone-800 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Total preview</h2>
            <dl className="tabular mt-3 space-y-1.5 text-sm">
              <Line label="Taxable value" value={preview.taxable} />
              {preview.cgst !== null && <Line label="CGST" value={preview.cgst} />}
              {preview.sgst !== null && <Line label="SGST" value={preview.sgst} />}
              {preview.igst !== null && <Line label="IGST" value={preview.igst} />}
              <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold text-amber-700">
                <dt>Grand total</dt>
                <dd>{formatINR(preview.total)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-stone-500">Preview only. The database computes and stores the final amounts when you save.</p>
          </section>

          <Card>
            <CardHeader title="Notes" />
            <div className="p-5">
              <Textarea aria-label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className="font-medium text-slate-800">{formatINR(value)}</dd>
    </div>
  )
}
