import { useState } from 'react'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { stockColumns } from '@/lib/exportColumns'
import { WhenCan } from '@/features/auth/WhenCan'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, Plus } from 'lucide-react'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizMutation, useBizQuery } from '@/hooks/useBiz'
import { useDebounce } from '@/hooks/useDebounce'
import { useMaterials, useStaffNames, useUnits } from '@/hooks/useLookups'
import { applyMovement, createStockItem, getStockItem, listMovements, listStock, type StockRow } from '@/services/operations'
import { createMaterial } from '@/services/catalog'
import { PAGE_SIZE } from '@/services/common'
import { Card, CardHeader, FilterBar, KpiCard, PageHeader, QuantityDisplay, SearchBar } from '@/components/ui/layout'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { FormField, Input, Select, Textarea } from '@/components/ui/form'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { formatDateTime, parseOptionalNumber } from '@/lib/format'
import type { MaterialCategory, StockMovement, StockMovementType } from '@/types/db'

/*
 * Stock is MOVEMENT-BASED: Opening + Received − Used/Sold ± Adjustments = Current.
 * quantity_on_hand changes only via apply_stock_movement(); a bill never moves
 * stock by itself. Units are whatever is stored — none is assumed.
 */

const CATEGORY_LABEL: Record<string, string> = {
  block: 'Blocks',
  cutting_stone: 'Cutting stone',
  raw_material: 'Raw material',
  finished: 'Finished',
  other: 'Other',
}

const MOVEMENTS: { value: StockMovementType; label: string; sign: 'in' | 'out' | 'either' }[] = [
  { value: 'opening_stock', label: 'Opening stock', sign: 'in' },
  { value: 'purchase', label: 'Purchase', sign: 'in' },
  { value: 'receipt', label: 'Receipt', sign: 'in' },
  { value: 'sale', label: 'Sale', sign: 'out' },
  { value: 'consumption', label: 'Consumption', sign: 'out' },
  { value: 'damage', label: 'Damage', sign: 'out' },
  { value: 'adjustment', label: 'Adjustment (+/−)', sign: 'either' },
  { value: 'transfer', label: 'Transfer (+/−)', sign: 'either' },
  { value: 'processing', label: 'Processing (+/−)', sign: 'either' },
  { value: 'return', label: 'Return (+/−)', sign: 'either' },
]

export function StockList() {
  const { code, isAdmin } = useBusinessContext()
  const navigate = useNavigate()
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [addingMaterial, setAddingMaterial] = useState(false)
  const dq = useDebounce(q)
  const query = useBizQuery(['stock', 'list', category, dq], (c) => listStock(c, { category: category || undefined, q: dq }))

  const columns: Column<StockRow>[] = [
    { key: 'name', header: 'Material', sortValue: (r) => r.materials?.name ?? null, cell: (r) => <span className="font-medium text-stone-900">{r.materials?.name ?? '—'}</span> },
    { key: 'cat', header: 'Category', cell: (r) => <StatusBadge>{CATEGORY_LABEL[r.materials?.category ?? ''] ?? '—'}</StatusBadge> },
    { key: 'batch', header: 'Batch / location', cell: (r) => [r.batch_code, r.location].filter(Boolean).join(' · ') || '—' },
    { key: 'open', header: 'Opening', numeric: true, cell: (r) => <QuantityDisplay value={r.opening_quantity} unit={r.unit} /> },
    { key: 'recv', header: 'Received', numeric: true, cell: (r) => <QuantityDisplay value={r.received_quantity} unit={r.unit} /> },
    { key: 'used', header: 'Used / sold', numeric: true, cell: (r) => <QuantityDisplay value={r.used_quantity} unit={r.unit} /> },
    { key: 'adj', header: 'Adjustments', numeric: true, cell: (r) => <QuantityDisplay value={r.adjustment_quantity} unit={r.unit} /> },
    { key: 'cur', header: 'Current', numeric: true, sortValue: (r) => r.current_quantity, cell: (r) => <QuantityDisplay value={r.current_quantity} unit={r.unit} className="font-semibold text-stone-900" /> },
  ]

  return (
    <div>
      <PageHeader
        title="Stock / raw material"
        description="Every quantity is the result of recorded movements. Bills and measurement sheets do not change stock by themselves."
        actions={
          <>
            <ExportCsvButton name="stock" columns={stockColumns} load={(c) => listStock(c, { category: category || undefined, q: dq })} />
            {isAdmin && <Button onClick={() => setAddingMaterial(true)}><Plus className="h-4 w-4" /> Material</Button>}
            <WhenCan module="stock"><Button variant="accent" onClick={() => setAddingItem(true)}><Plus className="h-4 w-4" /> Stock item</Button></WhenCan>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Stock items" loading={query.isLoading} value={query.data?.length ?? '—'} />
        <KpiCard label="At zero" tone="warning" loading={query.isLoading} value={query.data ? query.data.filter((r) => Number(r.current_quantity) === 0).length : '—'} />
        <KpiCard label="Categories in use" loading={query.isLoading} value={query.data ? new Set(query.data.map((r) => r.materials?.category)).size : '—'} hint="Quantities are not added together across different units" />
      </div>
      <Card>
        <FilterBar>
          <div className="w-full sm:w-64"><SearchBar value={q} onChange={setQ} placeholder="Search material or batch" /></div>
          <label className="block text-xs font-medium text-stone-600">
            Category
            <Select className="mt-1 w-44" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All</option>
              {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </label>
        </FilterBar>
        <DataTable columns={columns} rows={query.data} rowKey={(r) => r.stock_item_id} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}
          onRowClick={(r) => navigate(`/business/${code}/stock/${r.stock_item_id}`)}
          empty={{ title: 'No stock items', description: 'Create a stock item, then record its opening stock as a movement.' }} />
      </Card>
      <StockItemDialog open={addingItem} onOpenChange={setAddingItem} />
      {isAdmin && <MaterialDialog open={addingMaterial} onOpenChange={setAddingMaterial} />}
    </div>
  )
}

function MaterialDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const units = useUnits()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<MaterialCategory>('cutting_stone')
  const [hsn, setHsn] = useState('')
  const [unit, setUnit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const save = useBizMutation(createMaterial, { invalidate: [['materials'], ['stock']], onSuccess: () => { setName(''); setHsn(''); onOpenChange(false) } })
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add material" description="Materials are the product master used by stock. Admin only."
      footer={<><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => {
        if (!name.trim()) return setError('Name is required.')
        setError(null)
        save.mutate({ name: name.trim(), category, hsn_code: hsn.trim() || null, default_unit: unit || null, default_rate: null, low_stock_threshold: null }, { onError: (e) => setError(e.message) })
      }}>Save material</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" required className="sm:col-span-2">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</FormField>
        <FormField label="Category" required>{(p) => <Select {...p} value={category} onChange={(e) => setCategory(e.target.value as MaterialCategory)}>{Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</FormField>
        <FormField label="HSN">{(p) => <Input {...p} value={hsn} onChange={(e) => setHsn(e.target.value)} />}</FormField>
        <FormField label="Default unit" hint={units.data?.length ? undefined : 'No units defined yet (Settings → Stock).'}>{(p) => <Select {...p} value={unit} onChange={(e) => setUnit(e.target.value)}><option value="">—</option>{units.data?.map((u) => <option key={u.code} value={u.code}>{u.label}</option>)}</Select>}</FormField>
      </div>
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
    </Modal>
  )
}

function StockItemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const materials = useMaterials()
  const units = useUnits()
  const [materialId, setMaterialId] = useState('')
  const [batch, setBatch] = useState('')
  const [location, setLocation] = useState('')
  const [unit, setUnit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const save = useBizMutation(createStockItem, { invalidate: [['stock'], ['dashboard'], ['alerts']], onSuccess: () => { setBatch(''); setLocation(''); onOpenChange(false) } })
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New stock item" description="Starts at zero. Record its opening stock as a movement afterwards."
      footer={<><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => {
        if (!materialId) return setError('Choose a material.')
        setError(null)
        save.mutate({ material_id: materialId, batch_code: batch.trim() || null, location: location.trim() || null, unit: unit || null }, { onError: (e) => setError(e.message) })
      }}>Create</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Material" required className="sm:col-span-2" hint={materials.data?.length === 0 ? 'No materials yet — an administrator can add them.' : undefined}>
          {(p) => <Select {...p} value={materialId} onChange={(e) => setMaterialId(e.target.value)}><option value="">Select material…</option>{materials.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>}
        </FormField>
        <FormField label="Batch code">{(p) => <Input {...p} value={batch} onChange={(e) => setBatch(e.target.value)} />}</FormField>
        <FormField label="Location">{(p) => <Input {...p} value={location} onChange={(e) => setLocation(e.target.value)} />}</FormField>
        <FormField label="Unit" hint="As the business measures this item; none is assumed.">
          {(p) => <Select {...p} value={unit} onChange={(e) => setUnit(e.target.value)}><option value="">—</option>{units.data?.map((u) => <option key={u.code} value={u.code}>{u.label}</option>)}</Select>}
        </FormField>
      </div>
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
    </Modal>
  )
}

export function StockDetail() {
  const { id } = useParams()
  const { code } = useBusinessContext()
  const [page, setPage] = useState(0)
  const [moving, setMoving] = useState(false)
  const names = useStaffNames()
  const item = useBizQuery(['stock', 'detail', id ?? ''], (c) => getStockItem(c, id!), { enabled: !!id })
  const moves = useBizQuery(['stock', 'movements', id ?? '', page], (c) => listMovements(c, { stockItemId: id!, page }), { enabled: !!id })

  if (item.isLoading) return <Skeleton className="h-96" />
  if (item.error) return <ErrorState error={item.error} onRetry={() => void item.refetch()} />
  if (!item.data) return null
  const { balance: b, material } = item.data

  const columns: Column<StockMovement>[] = [
    { key: 'date', header: 'When', cell: (m) => formatDateTime(m.created_at) },
    { key: 'type', header: 'Movement', cell: (m) => <StatusBadge tone={m.quantity_change > 0 ? 'success' : 'warning'}>{m.movement_type.replace('_', ' ')}</StatusBadge> },
    { key: 'chg', header: 'Change', numeric: true, cell: (m) => <QuantityDisplay value={m.quantity_change} unit={b.unit} className={m.quantity_change > 0 ? 'text-emerald-700' : 'text-amber-700'} /> },
    { key: 'prev', header: 'Before', numeric: true, cell: (m) => <QuantityDisplay value={m.previous_quantity} /> },
    { key: 'new', header: 'After', numeric: true, cell: (m) => <QuantityDisplay value={m.new_quantity} className="font-medium" /> },
    { key: 'why', header: 'Reason', cell: (m) => m.reason ?? '—' },
    { key: 'by', header: 'By', cell: (m) => (m.performed_by ? (names.data?.[m.performed_by] ?? '—') : '—') },
  ]

  return (
    <div>
      <PageHeader
        title={material.name}
        crumbs={[{ label: 'Stock', to: `/business/${code}/stock` }, { label: material.name }]}
        description={[CATEGORY_LABEL[material.category], b.batch_code && `Batch ${b.batch_code}`, b.location].filter(Boolean).join(' · ')}
        actions={<WhenCan module="stock"><Button variant="accent" onClick={() => setMoving(true)}><ArrowLeftRight className="h-4 w-4" /> Add movement</Button></WhenCan>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Opening" value={<QuantityDisplay value={b.opening_quantity} unit={b.unit} />} />
        <KpiCard label="Received" value={<QuantityDisplay value={b.received_quantity} unit={b.unit} />} />
        <KpiCard label="Used / sold" value={<QuantityDisplay value={b.used_quantity} unit={b.unit} />} />
        <KpiCard label="Adjustments" value={<QuantityDisplay value={b.adjustment_quantity} unit={b.unit} />} />
        <KpiCard label="Current stock" tone="success" value={<QuantityDisplay value={b.current_quantity} unit={b.unit} />} hint={Number(b.current_quantity) === Number(b.quantity_on_hand) ? 'Matches the movement history' : 'Does not match history — report this'} />
      </div>
      <Card className="mt-6">
        <CardHeader title="Movement history" description="Newest first. Movements cannot be edited or deleted." />
        <DataTable columns={columns} rows={moves.data?.rows} rowKey={(m) => m.id} loading={moves.isLoading} error={moves.error} onRetry={() => void moves.refetch()}
          empty={{ title: 'No movements yet', description: 'Record the opening stock or a receipt to begin.' }}
          pagination={{ page, pageSize: PAGE_SIZE, total: moves.data?.total ?? 0, onPageChange: setPage }} />
      </Card>
      <MovementDialog open={moving} onOpenChange={setMoving} stockItemId={b.stock_item_id} unit={b.unit} />
      <p className="mt-4 text-xs text-stone-500"><Link className="text-amber-800 hover:underline" to={`/business/${code}/stock`}>← All stock</Link></p>
    </div>
  )
}

function MovementDialog({ open, onOpenChange, stockItemId, unit }: { open: boolean; onOpenChange: (o: boolean) => void; stockItemId: string; unit: string | null }) {
  const [type, setType] = useState<StockMovementType>('receipt')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const save = useBizMutation(applyMovement, { invalidate: [['stock'], ['dashboard'], ['alerts']], onSuccess: () => { setQty(''); setReason(''); onOpenChange(false) } })
  const sign = MOVEMENTS.find((m) => m.value === type)?.sign ?? 'either'

  function submit() {
    const n = parseOptionalNumber(qty)
    if (n === null || Number.isNaN(n) || n === 0) return setError('Enter a non-zero quantity.')
    if (sign !== 'either' && n < 0) return setError('Enter the quantity as a positive number — the direction is set by the movement type.')
    setError(null)
    const change = sign === 'out' ? -Math.abs(n) : sign === 'in' ? Math.abs(n) : n
    save.mutate({ stockItemId, type, change, reason: reason.trim() || null }, { onError: (e) => setError(e.message) })
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add stock movement" description="Stock can never go below zero."
      footer={<><Button onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={submit}>Record movement</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Movement type" required>{(p) => <Select {...p} value={type} onChange={(e) => setType(e.target.value as StockMovementType)}>{MOVEMENTS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>}</FormField>
        <FormField label={`Quantity${unit ? ` (${unit})` : ''}`} required hint={sign === 'either' ? 'Use − for a reduction.' : sign === 'out' ? 'Will reduce stock.' : 'Will add to stock.'}>
          {(p) => <Input {...p} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />}
        </FormField>
        <FormField label="Reason / note" className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}</FormField>
      </div>
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
    </Modal>
  )
}
