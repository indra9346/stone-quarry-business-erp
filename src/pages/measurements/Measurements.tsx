import { useEffect, useMemo, useState } from 'react'
import { WhenCan } from '@/features/auth/WhenCan'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizMutation, useBizQuery } from '@/hooks/useBiz'
import { useDebounce } from '@/hooks/useDebounce'
import { useCustomerPicker } from '@/hooks/useLookups'
import { createSheet, getSheet, listSheets, updateSheet, type MeasurementInput } from '@/services/documents'
import { PAGE_SIZE } from '@/services/common'
import { Card, CardHeader, CurrencyDisplay, FilterBar, PageHeader, PDFButton, PrintButton, SearchBar } from '@/components/ui/layout'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Textarea } from '@/components/ui/form'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { MeasurementDocument } from '@/components/documents/documents'
import { formatDate, formatINR, parseOptionalNumber } from '@/lib/format'

/*
 * Measurement sheets are INDEPENDENT documents stored exactly as written.
 * No unit, no formula (dimensions -> Qty is not confirmed), no meaning is given
 * to the PCS column, and nothing links a sheet to a bill, quotation, payment,
 * ledger entry or stock movement.
 */

export function MeasurementList() {
  const { code } = useBusinessContext()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const dq = useDebounce(q)
  const base = `/business/${code}/measurements`
  const query = useBizQuery(['measurements', 'list', dq, page], (c) => listSheets(c, { q: dq, page }))

  type Row = NonNullable<typeof query.data>['rows'][number]
  const columns: Column<Row>[] = [
    { key: 'no', header: 'Sheet no.', cell: (r) => <span className="font-medium text-stone-900">{r.sheet_number ?? '—'}</span> },
    { key: 'date', header: 'Date', sortValue: (r) => r.sheet_date, cell: (r) => formatDate(r.sheet_date) },
    { key: 'to', header: 'To (as written)', cell: (r) => r.party_name_text ?? '—' },
    { key: 'rows', header: 'Rows', numeric: true, sortValue: (r) => r.row_count, cell: (r) => r.row_count },
    { key: 'total', header: 'Total (as written)', numeric: true, sortValue: (r) => r.stated_total, cell: (r) => <CurrencyDisplay value={r.stated_total} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Measurement sheets"
        description="Independent documents, stored exactly as written. They are not linked to bills, quotations, payments, the ledger or stock."
        actions={
          <WhenCan module="measurements">
            <Link to={`${base}/new`} className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-bold text-slate-900 shadow-sm hover:bg-amber-400">
              <Plus className="h-4 w-4" /> New sheet
            </Link>
          </WhenCan>
        }
      />
      <Card>
        <FilterBar>
          <div className="w-full sm:w-72">
            <SearchBar value={q} onChange={(v) => { setQ(v); setPage(0) }} placeholder="Search sheet no. or name" />
          </div>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={query.data?.rows}
          rowKey={(r) => r.id}
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          onRowClick={(r) => navigate(`${base}/${r.id}`)}
          empty={{ title: 'No measurement sheets', description: 'Record a measurement sheet to see it here.' }}
          pagination={{ page, pageSize: PAGE_SIZE, total: query.data?.total ?? 0, onPageChange: setPage }}
        />
      </Card>
    </div>
  )
}

interface RowDraft {
  key: string
  measurement: string
  pcs: string
  quantity: string
  rate: string
  amount: string
}
let rk = 0
const newRow = (p: Partial<RowDraft> = {}): RowDraft => ({ key: `r${Date.now()}-${++rk}`, measurement: '', pcs: '', quantity: '', rate: '', amount: '', ...p })
const numText = (v: number | null) => (v === null ? '' : String(v))

export function MeasurementForm({ mode }: { mode: 'create' | 'edit' }) {
  const { code } = useBusinessContext()
  const { id } = useParams()
  const navigate = useNavigate()
  const customers = useCustomerPicker()
  const existing = useBizQuery(['measurements', 'detail', id ?? ''], (c) => getSheet(c, id!), { enabled: mode === 'edit' && !!id })

  const [sheetNumber, setSheetNumber] = useState('')
  const [sheetDate, setSheetDate] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [partyName, setPartyName] = useState('')
  const [statedTotal, setStatedTotal] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<RowDraft[]>([newRow()])
  const [errors, setErrors] = useState<string[]>([])
  const [loaded, setLoaded] = useState(mode === 'create')

  useEffect(() => {
    const d = existing.data
    if (!d || loaded) return
    setSheetNumber(d.sheet.sheet_number ?? '')
    setSheetDate(d.sheet.sheet_date ?? '')
    setCustomerId(d.sheet.customer_id ?? '')
    setPartyName(d.sheet.party_name_text ?? '')
    setStatedTotal(numText(d.sheet.stated_total))
    setNotes(d.sheet.notes ?? '')
    setRows(d.rows.length ? d.rows.map((r) => newRow({ measurement: r.measurement_text, pcs: r.pcs_text ?? '', quantity: numText(r.quantity), rate: numText(r.rate), amount: numText(r.amount) })) : [newRow()])
    setLoaded(true)
  }, [existing.data, loaded])

  const set = (key: string, patch: Partial<RowDraft>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  // Arithmetic check only — shown for the user, never written back.
  const check = useMemo(() => {
    const amounts = rows.map((r) => parseOptionalNumber(r.amount)).filter((n): n is number => n !== null && !Number.isNaN(n))
    const sum = Math.round(amounts.reduce((s, n) => s + n, 0) * 100) / 100
    const t = parseOptionalNumber(statedTotal)
    return { sum, has: amounts.length > 0, diff: t !== null && !Number.isNaN(t) ? Math.round((t - sum) * 100) / 100 : null }
  }, [rows, statedTotal])

  const save = useBizMutation(
    async (c, input: MeasurementInput) => {
      if (mode === 'edit' && id) {
        await updateSheet(c, id, input)
        return id
      }
      return (await createSheet(c, input)).id
    },
    { invalidate: [['measurements']], onSuccess: (sid) => navigate(`/business/${code}/measurements/${sid}`) },
  )

  function submit() {
    const errs: string[] = []
    const out: MeasurementInput['rows'] = []
    rows.forEach((r, i) => {
      const blank = !r.measurement.trim() && !r.pcs.trim() && !r.quantity.trim() && !r.rate.trim() && !r.amount.trim()
      if (blank) return
      if (!r.measurement.trim()) errs.push(`Row ${i + 1}: the measurement text is required.`)
      const nums = [parseOptionalNumber(r.quantity), parseOptionalNumber(r.rate), parseOptionalNumber(r.amount)]
      if (nums.some((n) => n !== null && Number.isNaN(n))) errs.push(`Row ${i + 1}: quantity, rate and amount must be numbers (or blank).`)
      out.push({ measurement_text: r.measurement.trim(), pcs_text: r.pcs.trim() || null, quantity: nums[0] ?? null, rate: nums[1] ?? null, amount: nums[2] ?? null })
    })
    const total = parseOptionalNumber(statedTotal)
    if (total !== null && Number.isNaN(total)) errs.push('The total must be a number (or blank).')
    if (errs.length) return setErrors(errs)
    setErrors([])
    save.mutate(
      {
        sheet_number: sheetNumber.trim() || null,
        sheet_date: sheetDate || null,
        customer_id: customerId || null,
        party_name_text: partyName.trim() || null,
        stated_total: total,
        notes: notes.trim() || null,
        rows: out,
      },
      { onError: (e) => setErrors([e.message]) },
    )
  }

  if (mode === 'edit') {
    if (existing.isLoading) return <Skeleton className="h-96" />
    if (existing.error) return <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
  }

  return (
    <div>
      <PageHeader
        title={mode === 'edit' ? 'Edit measurement sheet' : 'New measurement sheet'}
        crumbs={[{ label: 'Measurements', to: `/business/${code}/measurements` }, { label: mode === 'edit' ? 'Edit' : 'New' }]}
        actions={
          <>
            <Button onClick={() => navigate(-1)} disabled={save.isPending}>Cancel</Button>
            <Button variant="accent" loading={save.isPending} onClick={submit}>Save sheet</Button>
          </>
        }
      />
      {errors.length > 0 && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200" role="alert">
          <ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      <div className="space-y-6">
        <Card>
          <CardHeader title="Sheet" description="Every field is optional — leave a field blank if it is blank on the paper." />
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Sheet no.">{(p) => <Input {...p} value={sheetNumber} onChange={(e) => setSheetNumber(e.target.value)} />}</FormField>
            <FormField label="Date">{(p) => <Input {...p} type="date" value={sheetDate} onChange={(e) => setSheetDate(e.target.value)} />}</FormField>
            <FormField label="To (as written)">{(p) => <Input {...p} value={partyName} onChange={(e) => setPartyName(e.target.value)} />}</FormField>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">
                Customer record (optional)
              </label>
              <SearchableSelect
                value={customerId}
                onChange={setCustomerId}
                placeholder="Search or select customer…"
                options={[
                  { value: '', label: 'None' },
                  ...(customers.data ?? []).map((c) => ({
                    value: c.id,
                    label: c.customer_name,
                    sublabel: c.gstin ? `GST: ${c.gstin}` : c.billing_address || undefined,
                  })),
                ]}
              />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Rows" description="Type each value exactly as written. Nothing is calculated or converted." />
          <div className="p-5">
            <div className="hidden grid-cols-[3rem_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_2rem] gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500 md:grid">
              <span>Row</span><span>Measurement</span><span>PCS</span><span>Quantity</span><span>Rate</span><span>Amount</span><span />
            </div>
            <div className="space-y-3 md:space-y-2">
              {rows.map((r, i) => (
                <div key={r.key} className="grid grid-cols-2 gap-2 rounded-md bg-stone-50 p-3 md:grid-cols-[3rem_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_2rem] md:items-center md:bg-transparent md:p-0">
                  <span className="tabular text-sm text-stone-500">{i + 1}</span>
                  <Input className="col-span-2 md:col-span-1" aria-label={`Row ${i + 1} measurement`} placeholder="e.g. 52 × 18 × 9.5&quot;" value={r.measurement} onChange={(e) => set(r.key, { measurement: e.target.value })} />
                  <Input aria-label={`Row ${i + 1} PCS`} placeholder="PCS" value={r.pcs} onChange={(e) => set(r.key, { pcs: e.target.value })} />
                  <Input inputMode="decimal" aria-label={`Row ${i + 1} quantity`} placeholder="Qty" value={r.quantity} onChange={(e) => set(r.key, { quantity: e.target.value })} />
                  <Input inputMode="decimal" aria-label={`Row ${i + 1} rate`} placeholder="Rate" value={r.rate} onChange={(e) => set(r.key, { rate: e.target.value })} />
                  <Input inputMode="decimal" aria-label={`Row ${i + 1} amount`} placeholder="Amount" value={r.amount} onChange={(e) => set(r.key, { amount: e.target.value })} />
                  <button type="button" className="justify-self-end rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" aria-label={`Remove row ${i + 1}`} disabled={rows.length <= 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button className="mt-3" size="sm" onClick={() => setRows((rs) => [...rs, newRow()])}>
              <Plus className="h-3.5 w-3.5" /> Add row
            </Button>
          </div>
        </Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Total & notes" />
            <div className="grid gap-4 p-5">
              <FormField label="Total (as written on the sheet)">{(p) => <Input {...p} inputMode="decimal" value={statedTotal} onChange={(e) => setStatedTotal(e.target.value)} />}</FormField>
              <FormField label="Notes">{(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} />}</FormField>
            </div>
          </Card>
          <section className="rounded-xl border border-stone-200 bg-white p-5 text-stone-800 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Arithmetic check</h2>
            <p className="mt-1 text-xs text-stone-500">A convenience only — it never changes what is stored.</p>
            <dl className="tabular mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-stone-500">Sum of row amounts</dt><dd className="font-medium text-slate-800">{check.has ? formatINR(check.sum) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-stone-500">Total as written</dt><dd className="font-medium text-slate-800">{formatINR(parseOptionalNumber(statedTotal))}</dd></div>
              <div className="flex justify-between border-t border-stone-200 pt-2 font-bold text-amber-700"><dt>Difference</dt><dd>{check.diff === null ? '—' : formatINR(check.diff)}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

export function MeasurementDetail() {
  const { id } = useParams()
  const { code } = useBusinessContext()
  const query = useBizQuery(['measurements', 'detail', id ?? ''], (c) => getSheet(c, id!), { enabled: !!id })
  if (query.isLoading) return <Skeleton className="h-96" />
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (!query.data) return null
  const { sheet, rows, verification } = query.data
  const mismatch = verification?.rows_where_amount_differs_from_qty_x_rate ?? 0

  return (
    <div>
      <PageHeader
        title={`Measurement sheet ${sheet.sheet_number ?? ''}`.trim()}
        crumbs={[{ label: 'Measurements', to: `/business/${code}/measurements` }, { label: sheet.sheet_number ?? 'Sheet' }]}
        description={sheet.sheet_date ? formatDate(sheet.sheet_date) : 'No date on the sheet'}
        actions={
          <>
            <WhenCan module="measurements">
              <Link to={`/business/${code}/measurements/${sheet.id}/edit`}>
                <Button><Pencil className="h-4 w-4" /> Edit</Button>
              </Link>
            </WhenCan>
            <PrintButton />
            <PDFButton />
          </>
        }
      />
      {verification && (
        <div className="no-print mb-4 rounded-md bg-stone-50 px-4 py-3 text-sm text-stone-700 ring-1 ring-stone-200">
          <span className="font-medium">Arithmetic check (information only):</span> row amounts add up to {formatINR(verification.rows_amount_sum)}; total as written{' '}
          {formatINR(verification.stated_total)}
          {verification.difference !== null && (verification.difference === 0 ? ' — they match.' : ` — difference ${formatINR(verification.difference)}.`)}
          {mismatch > 0 && ` ${mismatch} row${mismatch === 1 ? '' : 's'} where the written amount differs from quantity × rate.`}
        </div>
      )}
      <MeasurementDocument sheet={sheet} rows={rows} />
    </div>
  )
}
