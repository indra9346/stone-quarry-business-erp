import { useEffect, useState } from 'react'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizMutation, useBizQuery } from '@/hooks/useBiz'
import { useSettings, useUnits } from '@/hooks/useLookups'
import { createStaffProfile, createUnit, listStaff, saveSetting, updateStaff } from '@/services/catalog'
import { listStock } from '@/services/operations'
import { Card, CardHeader, PageHeader } from '@/components/ui/layout'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/form'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'
import { parseOptionalNumber } from '@/lib/format'
import type { StaffProfile, Unit } from '@/types/db'

type Tab = 'business' | 'users' | 'permissions' | 'numbering' | 'billing' | 'tax' | 'stock' | 'system'
const TABS: { id: Tab; label: string }[] = [
  { id: 'business', label: 'Business' },
  { id: 'users', label: 'Users / staff' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'numbering', label: 'Document numbering' },
  { id: 'billing', label: 'Billing' },
  { id: 'tax', label: 'Tax' },
  { id: 'stock', label: 'Stock' },
  { id: 'system', label: 'System' },
]

export default function Settings() {
  const [tab, setTab] = useState<Tab>('business')
  return (
    <div>
      <PageHeader title="Settings" description="Administrators only. Every change is recorded in the audit log." />
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings sections">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id}
              className={cn('whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors', tab === t.id ? 'bg-navy-800 text-white' : 'text-slate-600 hover:bg-slate-200/70')}>
              {t.label}
            </button>
          ))}
        </nav>
        <div>
          {tab === 'business' && <BusinessTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'permissions' && <PermissionsTab />}
          {tab === 'numbering' && <NumberingTab />}
          {tab === 'billing' && <BillingTab />}
          {tab === 'tax' && <TaxTab />}
          {tab === 'stock' && <StockTab />}
          {tab === 'system' && <SystemTab />}
        </div>
      </div>
    </div>
  )
}

/** Shared editor for one row of the `settings` table (value is jsonb). */
function useSettingSaver(key: string) {
  return useBizMutation((c, value: Record<string, unknown>) => saveSetting(c, key, value), { invalidate: [['settings']] })
}
function Saved({ ok, error }: { ok: boolean; error: string | null }) {
  if (error) return <p className="text-sm text-red-700" role="alert">{error}</p>
  return ok ? <p className="text-sm text-emerald-700">Saved.</p> : null
}

function BusinessTab() {
  const settings = useSettings()
  const save = useSettingSaver('business_profile')
  const [f, setF] = useState({ name: '', address: '', phone: '', email: '', gstin: '' })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const p = (settings.data?.business_profile ?? {}) as Record<string, string>
    setF({ name: p.name ?? '', address: p.address ?? '', phone: p.phone ?? '', email: p.email ?? '', gstin: p.gstin ?? '' })
  }, [settings.data])
  if (settings.isLoading) return <Skeleton className="h-64" />
  if (settings.error) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
  const s = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))
  return (
    <Card>
      <CardHeader title="Business profile" description="Printed on the letterhead of bills, quotations, measurement sheets and reports." />
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <FormField label="Business name" className="sm:col-span-2">{(p) => <Input {...p} value={f.name} onChange={(e) => s('name', e.target.value)} />}</FormField>
        <FormField label="Address" className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={f.address} onChange={(e) => s('address', e.target.value)} />}</FormField>
        <FormField label="Phone">{(p) => <Input {...p} value={f.phone} onChange={(e) => s('phone', e.target.value)} />}</FormField>
        <FormField label="Email">{(p) => <Input {...p} type="email" value={f.email} onChange={(e) => s('email', e.target.value)} />}</FormField>
        <FormField label="GSTIN" hint="The business's tax registration number, as it should print." className="sm:col-span-2">{(p) => <Input {...p} value={f.gstin} onChange={(e) => s('gstin', e.target.value)} />}</FormField>
      </div>
      <div className="flex items-center justify-end gap-4 border-t border-slate-100 px-5 py-3">
        <Saved ok={save.isSuccess} error={error} />
        <Button variant="primary" loading={save.isPending} onClick={() => { setError(null); save.mutate(f, { onError: (e) => setError(e.message) }) }}>Save</Button>
      </div>
    </Card>
  )
}

function NumberingTab() {
  const settings = useSettings()
  const save = useSettingSaver('document_prefixes')
  const [f, setF] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setF((settings.data?.document_prefixes ?? {}) as Record<string, string>), [settings.data])
  if (settings.isLoading) return <Skeleton className="h-64" />
  const labels: [string, string][] = [['quotation', 'Quotation'], ['normal_bill', 'Normal bill'], ['ev_bill', 'EV bill'], ['payment', 'Payment'], ['trip', 'Trip'], ['expense', 'Expense']]
  return (
    <Card>
      <CardHeader title="Document number prefixes" description="Used only for numbers the system generates: PREFIX-YEAR-000001. Normal bills may always carry an existing physical number instead. EV bill numbering is not defined by the business yet." />
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        {labels.map(([k, l]) => <FormField key={k} label={l}>{(p) => <Input {...p} value={f[k] ?? ''} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} />}</FormField>)}
      </div>
      <div className="flex items-center justify-end gap-4 border-t border-slate-100 px-5 py-3">
        <Saved ok={save.isSuccess} error={error} />
        <Button variant="primary" loading={save.isPending} onClick={() => { setError(null); save.mutate(f, { onError: (e) => setError(e.message) }) }}>Save</Button>
      </div>
    </Card>
  )
}

function TaxTab() {
  const settings = useSettings()
  const save = useSettingSaver('tax_defaults')
  const [f, setF] = useState({ cgst_percent: '', sgst_percent: '', igst_percent: '' })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const t = (settings.data?.tax_defaults ?? {}) as Record<string, number | null>
    const str = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
    setF({ cgst_percent: str(t.cgst_percent), sgst_percent: str(t.sgst_percent), igst_percent: str(t.igst_percent) })
  }, [settings.data])
  if (settings.isLoading) return <Skeleton className="h-48" />
  function submit() {
    const out: Record<string, number | null> = {}
    for (const [k, v] of Object.entries(f)) {
      const n = parseOptionalNumber(v)
      if (n !== null && (Number.isNaN(n) || n < 0 || n > 100)) return setError('Percentages must be between 0 and 100 (or blank).')
      out[k] = n
    }
    setError(null)
    save.mutate(out, { onError: (e) => setError(e.message) })
  }
  return (
    <Card>
      <CardHeader title="Tax defaults" description="Reference values only. Percentages are entered per bill; blank means “not used”, never 0. No rate is assumed by the system." />
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <FormField label="CGST %">{(p) => <Input {...p} inputMode="decimal" value={f.cgst_percent} onChange={(e) => setF((s) => ({ ...s, cgst_percent: e.target.value }))} />}</FormField>
        <FormField label="SGST %">{(p) => <Input {...p} inputMode="decimal" value={f.sgst_percent} onChange={(e) => setF((s) => ({ ...s, sgst_percent: e.target.value }))} />}</FormField>
        <FormField label="IGST %">{(p) => <Input {...p} inputMode="decimal" value={f.igst_percent} onChange={(e) => setF((s) => ({ ...s, igst_percent: e.target.value }))} />}</FormField>
      </div>
      <div className="flex items-center justify-end gap-4 border-t border-slate-100 px-5 py-3">
        <Saved ok={save.isSuccess} error={error} />
        <Button variant="primary" loading={save.isPending} onClick={submit}>Save</Button>
      </div>
    </Card>
  )
}

function BillingTab() {
  return (
    <Card>
      <CardHeader title="Billing rules" description="These are enforced by the database and are not configurable." />
      <ul className="list-disc space-y-2 p-5 pl-9 text-sm text-slate-700">
        <li>Bill totals are calculated by the database from the lines, discount, tax percentages and other charges — to the paisa (2 decimals).</li>
        <li>A line is either descriptive (no quantity, rate or amount) or fully priced (quantity × rate).</li>
        <li>Bill numbers are unique per bill type: Normal 52 and EV 52 can both exist.</li>
        <li>Posting a bill creates exactly one ledger debit and locks the bill. Cancelling keeps the bill on record and reverses the debit.</li>
        <li>Payment reversal and correcting a posted bill (other than cancel-and-reissue) are not defined by the business yet.</li>
        <li>EV Bill specifics (format, extra fields, numbering) are pending the business's definition.</li>
      </ul>
    </Card>
  )
}

function StockTab() {
  const units = useUnits()
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<Unit['measurement_kind']>('other')
  const [error, setError] = useState<string | null>(null)
  const add = useBizMutation(createUnit, { invalidate: [['units']], onSuccess: () => { setCode(''); setLabel('') } })
  const columns: Column<Unit>[] = [
    { key: 'c', header: 'Code', cell: (u) => u.code },
    { key: 'l', header: 'Label', cell: (u) => u.label },
    { key: 'k', header: 'Kind', cell: (u) => u.measurement_kind },
  ]
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Units" description="Units the business measures in. None is preset — add only what you actually use. A unit is always optional on a line or stock item." />
        <DataTable dense columns={columns} rows={units.data} rowKey={(u) => u.code} loading={units.isLoading} error={units.error} empty={{ title: 'No units defined yet' }} />
        <div className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-4 sm:items-end">
          <FormField label="Code">{(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value)} />}</FormField>
          <FormField label="Label">{(p) => <Input {...p} value={label} onChange={(e) => setLabel(e.target.value)} />}</FormField>
          <FormField label="Kind">{(p) => <Select {...p} value={kind} onChange={(e) => setKind(e.target.value as Unit['measurement_kind'])}><option value="other">Other</option><option value="count">Count</option><option value="area">Area</option><option value="volume">Volume</option><option value="weight">Weight</option></Select>}</FormField>
          <Button variant="primary" loading={add.isPending} onClick={() => {
            if (!code.trim() || !label.trim()) return setError('Code and label are required.')
            setError(null)
            add.mutate({ code: code.trim(), label: label.trim(), measurement_kind: kind }, { onError: (e) => setError(e.message) })
          }}>Add unit</Button>
        </div>
        {error && <p className="px-5 pb-4 text-sm text-red-700" role="alert">{error}</p>}
      </Card>
      <Card>
        <CardHeader title="Stock rules" description="Enforced by the database." />
        <ul className="list-disc space-y-2 p-5 pl-9 text-sm text-slate-700">
          <li>Stock is movement-based; current stock = opening + received − used/sold ± adjustments.</li>
          <li>Stock can never go below zero, and quantities cannot be edited directly.</li>
          <li>Bills and measurement sheets do not move stock; only explicit movements do.</li>
        </ul>
      </Card>
    </div>
  )
}

function UsersTab() {
  const { userId } = useBusinessContext()
  const query = useBizQuery(['staff', 'list'], listStaff)
  const update = useBizMutation((c, v: { id: string; patch: Partial<Pick<StaffProfile, 'role' | 'status'>> }) => updateStaff(c, v.id, v.patch), { invalidate: [['staff']] })
  const create = useBizMutation(createStaffProfile, { invalidate: [['staff']], onSuccess: () => { setId(''); setName('') } })
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [error, setError] = useState<string | null>(null)

  const columns: Column<StaffProfile>[] = [
    { key: 'n', header: 'Name', cell: (s) => <span className="font-medium text-slate-900">{s.full_name}{s.user_id === userId ? ' (you)' : ''}</span> },
    { key: 'r', header: 'Role', cell: (s) => (
      <Select aria-label={`Role for ${s.full_name}`} className="w-28" value={s.role} disabled={s.user_id === userId} onChange={(e) => update.mutate({ id: s.user_id, patch: { role: e.target.value as 'admin' | 'staff' } }, { onError: (er) => setError(er.message) })}>
        <option value="admin">Admin</option><option value="staff">Staff</option>
      </Select>) },
    { key: 's', header: 'Status', cell: (s) => (
      <Button size="sm" disabled={s.user_id === userId} onClick={() => update.mutate({ id: s.user_id, patch: { status: s.status === 'active' ? 'inactive' : 'active' } }, { onError: (er) => setError(er.message) })}>
        <StatusBadge tone={s.status === 'active' ? 'success' : 'neutral'}>{s.status}</StatusBadge> {s.status === 'active' ? 'Deactivate' : 'Activate'}
      </Button>) },
  ]
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Staff" description="Deactivating a user blocks their access to this business immediately." />
        <DataTable dense columns={columns} rows={query.data} rowKey={(s) => s.user_id} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} empty={{ title: 'No staff profiles' }} />
        {error && <p className="px-5 pb-4 text-sm text-red-700" role="alert">{error}</p>}
      </Card>
      <Card>
        <CardHeader title="Grant access to an existing login" description="First create the person's login in Supabase → Authentication → Users for THIS business's project, then paste their User ID here. Logins cannot be created from the browser." />
        <div className="grid gap-3 p-5 sm:grid-cols-4 sm:items-end">
          <FormField label="User ID (UUID)" className="sm:col-span-2">{(p) => <Input {...p} value={id} onChange={(e) => setId(e.target.value)} />}</FormField>
          <FormField label="Full name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</FormField>
          <FormField label="Role">{(p) => <Select {...p} value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}><option value="staff">Staff</option><option value="admin">Admin</option></Select>}</FormField>
          <Button variant="primary" className="sm:col-span-4 sm:w-fit" loading={create.isPending} onClick={() => {
            if (!/^[0-9a-f-]{36}$/i.test(id.trim())) return setError('Enter the user\'s UUID.')
            if (!name.trim()) return setError('Enter the person\'s name.')
            setError(null)
            create.mutate({ user_id: id.trim(), full_name: name.trim(), role, phone: null }, { onError: (e) => setError(e.message) })
          }}>Grant access</Button>
        </div>
      </Card>
    </div>
  )
}

function PermissionsTab() {
  const rows: [string, string, string][] = [
    ['Dashboard, Bills (EV & Normal), Quotations, Measurements, Customers, Payments', 'Yes', 'Yes'],
    ['Stock / raw material, Vehicles, Drivers, Trips', 'Yes', 'Yes'],
    ['Customer ledger', 'Yes', 'No'],
    ['Expenses', 'Yes', 'No'],
    ['Reports', 'Yes', 'No'],
    ['Settings & user management', 'Yes', 'No'],
    ['Audit logs (read-only)', 'Yes', 'No'],
    ['Cancel a bill · delete a draft bill · ledger adjustments', 'Yes', 'No'],
  ]
  return (
    <Card>
      <CardHeader title="Role permissions" description="Enforced by the database (row-level security and column privileges), not just by the menu. Shown here for reference; they cannot be changed from the browser." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead><tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500"><th className="px-5 py-2.5">Area</th><th className="px-3 py-2.5">Admin</th><th className="px-3 py-2.5">Staff</th></tr></thead>
          <tbody>{rows.map(([a, ad, st]) => <tr key={a} className="border-t border-slate-100"><td className="px-5 py-2.5">{a}</td><td className="px-3 py-2.5"><StatusBadge tone={ad === 'Yes' ? 'success' : 'neutral'}>{ad}</StatusBadge></td><td className="px-3 py-2.5"><StatusBadge tone={st === 'Yes' ? 'success' : 'neutral'}>{st}</StatusBadge></td></tr>)}</tbody>
        </table>
      </div>
    </Card>
  )
}

function SystemTab() {
  const { profile, code, email, role } = useBusinessContext()
  const probe = useBizQuery(['system', 'probe'], async (c) => (await listStock(c, {})).length)
  const host = (() => {
    const u = import.meta.env[`VITE_${code.toUpperCase()}_SUPABASE_URL`] as string | undefined
    try { return u ? new URL(u).host : '—' } catch { return '—' }
  })()
  return (
    <Card>
      <CardHeader title="System" description="Read-only connection information (no secrets are ever shown)." />
      <dl className="space-y-3 p-5 text-sm">
        {[
          ['Business', profile.name], ['Business code', code], ['Database host', host], ['Signed in as', `${email ?? '—'} (${role})`],
          ['Business timezone', 'Asia/Kolkata'], ['Currency', 'INR (₹)'], ['Connection check', probe.isLoading ? 'Checking…' : probe.error ? `Failed: ${probe.error.message}` : 'OK'],
        ].map(([k, v]) => <div key={k} className="flex justify-between gap-6"><dt className="text-slate-500">{k}</dt><dd className="break-all text-right font-medium text-slate-900">{v}</dd></div>)}
      </dl>
    </Card>
  )
}
