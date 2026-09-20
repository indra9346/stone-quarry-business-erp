import { useEffect, useState } from 'react'
import { WhenCan } from '@/features/auth/WhenCan'
import { Plus } from 'lucide-react'
import { useBizMutation, useBizQuery } from '@/hooks/useBiz'
import { useCustomerPicker, usePrefix } from '@/hooks/useLookups'
import { listDrivers, listTrips, listVehicles, saveDriver, saveTrip, saveVehicle, type TripRow } from '@/services/operations'
import { generateNumber } from '@/services/bills'
import { PAGE_SIZE } from '@/services/common'
import { Card, DateRangePicker, FilterBar, PageHeader } from '@/components/ui/layout'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { FormField, Input, Select, Textarea } from '@/components/ui/form'
import { StatusBadge, type Tone } from '@/components/ui/StatusBadge'
import { formatDate, parseOptionalNumber, todayIST } from '@/lib/format'
import type { Driver, TripStatus, Vehicle, VehicleStatus } from '@/types/db'

const vehicleTone: Record<VehicleStatus, Tone> = { available: 'success', on_trip: 'info', maintenance: 'warning', inactive: 'neutral' }
const tripTone: Record<TripStatus, Tone> = { planned: 'neutral', loaded: 'info', in_transit: 'info', delivered: 'success', cancelled: 'danger' }
const nn = (s: string) => s.trim() || null

/* ============================================================== VEHICLES */
export function VehiclesPage() {
  const query = useBizQuery(['vehicles', 'list'], listVehicles)
  const drivers = useBizQuery(['drivers', 'list'], listDrivers)
  const trips = useBizQuery(['trips', 'recent-by-vehicle'], (c) => listTrips(c, { page: 0 }))
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null)

  const columns: Column<Vehicle>[] = [
    { key: 'no', header: 'Vehicle no.', sortValue: (v) => v.registration_number, cell: (v) => <span className="font-medium text-stone-900">{v.registration_number}</span> },
    { key: 'type', header: 'Type', cell: (v) => [v.vehicle_type, v.make_model].filter(Boolean).join(' · ') || '—' },
    { key: 'driver', header: 'Assigned driver', cell: (v) => drivers.data?.find((d) => d.id === v.default_driver_id)?.driver_name ?? '—' },
    { key: 'cap', header: 'Capacity', cell: (v) => v.capacity ?? '—' },
    { key: 'trip', header: 'Recent trip', cell: (v) => { const t = trips.data?.rows.find((x) => x.vehicle_id === v.id); return t ? `${t.trip_number} · ${formatDate(t.trip_date)}` : '—' } },
    { key: 'st', header: 'Status', cell: (v) => <StatusBadge tone={vehicleTone[v.status]}>{v.status.replace('_', ' ')}</StatusBadge> },
  ]
  return (
    <div>
      <PageHeader title="Vehicles" actions={<WhenCan module="vehicles"><Button variant="accent" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add vehicle</Button></WhenCan>} />
      <Card>
        <DataTable columns={columns} rows={query.data} rowKey={(v) => v.id} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}
          onRowClick={(v) => setEditing(v)} empty={{ title: 'No vehicles yet', description: 'Add a vehicle to assign it to trips.' }} />
      </Card>
      <VehicleDialog value={editing} onClose={() => setEditing(null)} drivers={drivers.data ?? []} />
    </div>
  )
}

function VehicleDialog({ value, onClose, drivers }: { value: Vehicle | 'new' | null; onClose: () => void; drivers: Driver[] }) {
  const v = value && value !== 'new' ? value : null
  const [f, setF] = useState({ reg: '', type: '', model: '', driver: '', capacity: '', status: 'available' as VehicleStatus, notes: '' })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (value) {
      setError(null)
      setF({ reg: v?.registration_number ?? '', type: v?.vehicle_type ?? '', model: v?.make_model ?? '', driver: v?.default_driver_id ?? '', capacity: v?.capacity ?? '', status: v?.status ?? 'available', notes: v?.notes ?? '' })
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = useBizMutation((c, x: Omit<Vehicle, 'id'>) => saveVehicle(c, v?.id ?? null, x), { invalidate: [['vehicles']], onSuccess: onClose })
  const s = (k: keyof typeof f, val: string) => setF((p) => ({ ...p, [k]: val }))
  return (
    <Modal open={value !== null} onOpenChange={(o) => !o && onClose()} title={v ? 'Edit vehicle' : 'Add vehicle'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => {
        if (!f.reg.trim()) return setError('Vehicle number is required.')
        setError(null)
        save.mutate({ registration_number: f.reg.trim(), vehicle_type: nn(f.type), make_model: nn(f.model), default_driver_id: f.driver || null, capacity: nn(f.capacity), status: f.status, notes: nn(f.notes) }, { onError: (e) => setError(e.message) })
      }}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Vehicle number" required>{(p) => <Input {...p} value={f.reg} onChange={(e) => s('reg', e.target.value)} />}</FormField>
        <FormField label="Status">{(p) => <Select {...p} value={f.status} onChange={(e) => s('status', e.target.value)}><option value="available">Available</option><option value="on_trip">On trip</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></Select>}</FormField>
        <FormField label="Type">{(p) => <Input {...p} value={f.type} onChange={(e) => s('type', e.target.value)} />}</FormField>
        <FormField label="Make / model">{(p) => <Input {...p} value={f.model} onChange={(e) => s('model', e.target.value)} />}</FormField>
        <FormField label="Assigned driver">{(p) => <Select {...p} value={f.driver} onChange={(e) => s('driver', e.target.value)}><option value="">—</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.driver_name}</option>)}</Select>}</FormField>
        <FormField label="Capacity">{(p) => <Input {...p} value={f.capacity} onChange={(e) => s('capacity', e.target.value)} />}</FormField>
        <FormField label="Notes" className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={f.notes} onChange={(e) => s('notes', e.target.value)} />}</FormField>
      </div>
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
    </Modal>
  )
}

/* =============================================================== DRIVERS */
export function DriversPage() {
  const query = useBizQuery(['drivers', 'list'], listDrivers)
  const [editing, setEditing] = useState<Driver | 'new' | null>(null)
  const columns: Column<Driver>[] = [
    { key: 'name', header: 'Driver', sortValue: (d) => d.driver_name, cell: (d) => <span className="font-medium text-stone-900">{d.driver_name}</span> },
    { key: 'phone', header: 'Phone', cell: (d) => d.phone ?? '—' },
    { key: 'lic', header: 'Licence no.', cell: (d) => d.license_number ?? '—' },
    { key: 'exp', header: 'Licence expiry', cell: (d) => formatDate(d.license_expiry) },
    { key: 'st', header: 'Status', cell: (d) => <StatusBadge tone={d.status === 'active' ? 'success' : 'neutral'}>{d.status}</StatusBadge> },
  ]
  return (
    <div>
      <PageHeader title="Drivers" actions={<WhenCan module="drivers"><Button variant="accent" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add driver</Button></WhenCan>} />
      <Card>
        <DataTable columns={columns} rows={query.data} rowKey={(d) => d.id} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}
          onRowClick={(d) => setEditing(d)} empty={{ title: 'No drivers yet' }} />
      </Card>
      <DriverDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function DriverDialog({ value, onClose }: { value: Driver | 'new' | null; onClose: () => void }) {
  const d = value && value !== 'new' ? value : null
  const [f, setF] = useState({ name: '', phone: '', lic: '', exp: '', address: '', status: 'active' as 'active' | 'inactive', notes: '' })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (value) { setError(null); setF({ name: d?.driver_name ?? '', phone: d?.phone ?? '', lic: d?.license_number ?? '', exp: d?.license_expiry ?? '', address: d?.address ?? '', status: d?.status ?? 'active', notes: d?.notes ?? '' }) }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = useBizMutation((c, x: Omit<Driver, 'id'>) => saveDriver(c, d?.id ?? null, x), { invalidate: [['drivers']], onSuccess: onClose })
  const s = (k: keyof typeof f, val: string) => setF((p) => ({ ...p, [k]: val }))
  return (
    <Modal open={value !== null} onOpenChange={(o) => !o && onClose()} title={d ? 'Edit driver' : 'Add driver'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => {
        if (!f.name.trim()) return setError('Driver name is required.')
        setError(null)
        save.mutate({ driver_name: f.name.trim(), phone: nn(f.phone), license_number: nn(f.lic), license_expiry: f.exp || null, address: nn(f.address), status: f.status, notes: nn(f.notes) }, { onError: (e) => setError(e.message) })
      }}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" required>{(p) => <Input {...p} value={f.name} onChange={(e) => s('name', e.target.value)} />}</FormField>
        <FormField label="Phone" hint="Contact information only.">{(p) => <Input {...p} type="tel" value={f.phone} onChange={(e) => s('phone', e.target.value)} />}</FormField>
        <FormField label="Licence no.">{(p) => <Input {...p} value={f.lic} onChange={(e) => s('lic', e.target.value)} />}</FormField>
        <FormField label="Licence expiry">{(p) => <Input {...p} type="date" value={f.exp} onChange={(e) => s('exp', e.target.value)} />}</FormField>
        <FormField label="Status">{(p) => <Select {...p} value={f.status} onChange={(e) => s('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></Select>}</FormField>
        <FormField label="Address" className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={f.address} onChange={(e) => s('address', e.target.value)} />}</FormField>
      </div>
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
    </Modal>
  )
}

/* ================================================================= TRIPS */
export function TripsPage() {
  const vehicles = useBizQuery(['vehicles', 'list'], listVehicles)
  const drivers = useBizQuery(['drivers', 'list'], listDrivers)
  const [status, setStatus] = useState<TripStatus | ''>('')
  const [vehicleId, setVehicleId] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<TripRow | 'new' | null>(null)
  const query = useBizQuery(['trips', 'list', status, vehicleId, range.from, range.to, page], (c) =>
    listTrips(c, { status: status || undefined, vehicleId: vehicleId || undefined, from: range.from || undefined, to: range.to || undefined, page }),
  )
  const columns: Column<TripRow>[] = [
    { key: 'no', header: 'Trip no.', cell: (t) => <span className="font-medium text-stone-900">{t.trip_number}</span> },
    { key: 'date', header: 'Date', sortValue: (t) => t.trip_date, cell: (t) => formatDate(t.trip_date) },
    { key: 'veh', header: 'Vehicle', cell: (t) => t.vehicles?.registration_number ?? '—' },
    { key: 'drv', header: 'Driver', cell: (t) => t.drivers?.driver_name ?? '—' },
    { key: 'cust', header: 'Customer', cell: (t) => t.customers?.customer_name ?? '—' },
    { key: 'dest', header: 'Destination', cell: (t) => t.destination ?? '—' },
    { key: 'st', header: 'Status', cell: (t) => <StatusBadge tone={tripTone[t.status]}>{t.status.replace('_', ' ')}</StatusBadge> },
  ]
  return (
    <div>
      <PageHeader title="Trips" description="Loads and deliveries." actions={<WhenCan module="trips"><Button variant="accent" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> New trip</Button></WhenCan>} />
      <Card>
        <FilterBar>
          <label className="block text-xs font-medium text-stone-600">Status
            <Select className="mt-1 w-40" value={status} onChange={(e) => { setStatus(e.target.value as TripStatus | ''); setPage(0) }}>
              <option value="">All</option><option value="planned">Planned</option><option value="loaded">Loaded</option><option value="in_transit">In transit</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>
            </Select>
          </label>
          <label className="block text-xs font-medium text-stone-600">Vehicle
            <Select className="mt-1 w-44" value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setPage(0) }}>
              <option value="">All</option>{vehicles.data?.map((v) => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
            </Select>
          </label>
          <DateRangePicker from={range.from} to={range.to} onChange={(r) => { setRange(r); setPage(0) }} />
        </FilterBar>
        <DataTable columns={columns} rows={query.data?.rows} rowKey={(t) => t.id} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}
          onRowClick={(t) => setEditing(t)} empty={{ title: 'No trips found' }} pagination={{ page, pageSize: PAGE_SIZE, total: query.data?.total ?? 0, onPageChange: setPage }} />
      </Card>
      <TripDialog value={editing} onClose={() => setEditing(null)} vehicles={vehicles.data ?? []} drivers={drivers.data ?? []} />
    </div>
  )
}

function TripDialog({ value, onClose, vehicles, drivers }: { value: TripRow | 'new' | null; onClose: () => void; vehicles: Vehicle[]; drivers: Driver[] }) {
  const t = value && value !== 'new' ? value : null
  const customers = useCustomerPicker()
  const prefix = usePrefix('trip')
  const [f, setF] = useState({ vehicle: '', driver: '', customer: '', date: todayIST(), pickup: '', dest: '', qty: '', status: 'planned' as TripStatus, notes: '' })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (value) {
      setError(null)
      setF({ vehicle: t?.vehicle_id ?? '', driver: t?.driver_id ?? '', customer: t?.customer_id ?? '', date: t?.trip_date ?? todayIST(), pickup: t?.pickup_location ?? '', dest: t?.destination ?? '', qty: t?.quantity == null ? '' : String(t.quantity), status: t?.status ?? 'planned', notes: t?.notes ?? '' })
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = useBizMutation(
    async (c, x: { qty: number | null }) => {
      const number = t ? t.trip_number : await generateNumber(c, 'trip', prefix)
      await saveTrip(c, t?.id ?? null, {
        trip_number: number, vehicle_id: f.vehicle, driver_id: f.driver || null, customer_id: f.customer || null, bill_id: t?.bill_id ?? null,
        material_id: t?.material_id ?? null, quantity: x.qty, unit: t?.unit ?? null, pickup_location: nn(f.pickup), destination: nn(f.dest),
        trip_date: f.date, status: f.status, notes: nn(f.notes),
      })
    },
    { invalidate: [['trips'], ['dashboard']], onSuccess: onClose },
  )
  const s = (k: keyof typeof f, val: string) => setF((p) => ({ ...p, [k]: val }))
  return (
    <Modal open={value !== null} onOpenChange={(o) => !o && onClose()} title={t ? `Trip ${t.trip_number}` : 'New trip'} size="lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => {
        const q = parseOptionalNumber(f.qty)
        if (!f.vehicle) return setError('Choose a vehicle.')
        if (q !== null && Number.isNaN(q)) return setError('Load quantity must be a number (or blank).')
        setError(null)
        save.mutate({ qty: q }, { onError: (e) => setError(e.message) })
      }}>Save trip</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Vehicle" required>{(p) => <Select {...p} value={f.vehicle} onChange={(e) => s('vehicle', e.target.value)}><option value="">Select…</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.registration_number}</option>)}</Select>}</FormField>
        <FormField label="Driver">{(p) => <Select {...p} value={f.driver} onChange={(e) => s('driver', e.target.value)}><option value="">—</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.driver_name}</option>)}</Select>}</FormField>
        <FormField label="Customer">{(p) => <Select {...p} value={f.customer} onChange={(e) => s('customer', e.target.value)}><option value="">—</option>{customers.data?.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}</Select>}</FormField>
        <FormField label="Trip date" required>{(p) => <Input {...p} type="date" value={f.date} onChange={(e) => s('date', e.target.value)} />}</FormField>
        <FormField label="Pickup location">{(p) => <Input {...p} value={f.pickup} onChange={(e) => s('pickup', e.target.value)} />}</FormField>
        <FormField label="Destination">{(p) => <Input {...p} value={f.dest} onChange={(e) => s('dest', e.target.value)} />}</FormField>
        <FormField label="Load quantity" hint="Free number; no unit assumed.">{(p) => <Input {...p} inputMode="decimal" value={f.qty} onChange={(e) => s('qty', e.target.value)} />}</FormField>
        <FormField label="Status">{(p) => <Select {...p} value={f.status} onChange={(e) => s('status', e.target.value)}><option value="planned">Planned</option><option value="loaded">Loaded</option><option value="in_transit">In transit</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></Select>}</FormField>
        <FormField label="Notes" className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={f.notes} onChange={(e) => s('notes', e.target.value)} />}</FormField>
      </div>
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
    </Modal>
  )
}
