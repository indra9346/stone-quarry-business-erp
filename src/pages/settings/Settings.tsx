import { useEffect, useState } from 'react'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizMutation, useBizQuery } from '@/hooks/useBiz'
import { useSettings, useUnits } from '@/hooks/useLookups'
import { COMMON_QUARRY_UNITS } from '@/config/quarryUnits'
import { createStaffLogin, createStaffProfile, createUnit, createUnits, updateUnit, listStaff, saveSetting, updateStaff } from '@/services/catalog'
import { listStock } from '@/services/operations'
import { Card, CardHeader, PageHeader } from '@/components/ui/layout'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/form'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Modal } from '@/components/ui/Dialog'
import { PermissionGrid, type PermissionValue } from './PermissionGrid'
import { compactPermissions, effectivePermissions, LEVEL_LABEL, PERMISSION_MODULES, type PermissionLevel } from '@/lib/permissions'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'
import { parseOptionalNumber } from '@/lib/format'
import { seedDemoData, clearDemoData } from '@/services/demoData'
import type { StaffProfile, Unit } from '@/types/db'

type Tab = 'business' | 'users' | 'permissions' | 'numbering' | 'billing' | 'tax' | 'stock' | 'system' | 'demo'
const TABS: { id: Tab; label: string }[] = [
  { id: 'business', label: 'Business' },
  { id: 'users', label: 'Users / staff' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'numbering', label: 'Document numbering' },
  { id: 'billing', label: 'Billing' },
  { id: 'tax', label: 'Tax' },
  { id: 'stock', label: 'Stock' },
  { id: 'system', label: 'System' },
  { id: 'demo', label: 'Demo / Test Data' },
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
              className={cn('whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors', tab === t.id ? 'bg-slate-800 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-200/70')}>
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
          {tab === 'demo' && <DemoTab />}
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
      <div className="flex items-center justify-end gap-4 border-t border-stone-100 px-5 py-3">
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
  const labels: [string, string][] = [['quotation', 'Quotation'], ['normal_bill', 'Bill'], ['payment', 'Payment'], ['trip', 'Trip'], ['expense', 'Expense']]
  return (
    <Card>
      <CardHeader title="Document number prefixes" description="Used only for numbers the system generates: PREFIX-YEAR-000001. Bills may always carry an existing physical number instead." />
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        {labels.map(([k, l]) => <FormField key={k} label={l}>{(p) => <Input {...p} value={f[k] ?? ''} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} />}</FormField>)}
      </div>
      <div className="flex items-center justify-end gap-4 border-t border-stone-100 px-5 py-3">
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
      <div className="flex items-center justify-end gap-4 border-t border-stone-100 px-5 py-3">
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
      <ul className="list-disc space-y-2 p-5 pl-9 text-sm text-stone-700">
        <li>Bill totals are calculated by the database from the lines, discount, tax percentages and other charges — to the paisa (2 decimals).</li>
        <li>A line is either descriptive (no quantity, rate or amount) or fully priced (pieces × rate).</li>
        <li>Posting a bill creates exactly one ledger debit and locks the bill. Cancelling keeps the bill on record and reverses the debit.</li>
        <li>Payment reversal and correcting a posted bill (other than cancel-and-reissue) are not defined by the business yet.</li>
      </ul>
    </Card>
  )
}

const KIND_LABEL: Record<Unit['measurement_kind'], string> = { other: 'Other', count: 'Count', area: 'Area', volume: 'Volume', weight: 'Weight' }

function StockTab() {
  const units = useUnits()
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<Unit['measurement_kind']>('other')
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const add = useBizMutation(createUnit, { invalidate: [['units']], onSuccess: () => { setCode(''); setLabel(''); setKind('other') } })
  const save = useBizMutation((c, v: { code: string; label: string; kind: Unit['measurement_kind'] }) => updateUnit(c, v.code, { label: v.label, measurement_kind: v.kind }), {
    invalidate: [['units']],
    onSuccess: () => { setEditingCode(null); setCode(''); setLabel(''); setKind('other') },
  })
  const addMany = useBizMutation(createUnits, { invalidate: [['units']], onSuccess: (_d, v) => { setPicked(new Set()); setNote(`Added ${v.length} unit${v.length === 1 ? '' : 's'}.`) } })

  const existing = new Set((units.data ?? []).map((u) => u.code.toLowerCase()))
  const available = COMMON_QUARRY_UNITS.filter((u) => !existing.has(u.code.toLowerCase()))

  const columns: Column<Unit>[] = [
    { key: 'c', header: 'Code', cell: (u) => <span className="font-medium text-stone-900">{u.code}</span> },
    { key: 'l', header: 'Label', cell: (u) => u.label },
    { key: 'k', header: 'Kind', cell: (u) => KIND_LABEL[u.measurement_kind] },
    { key: 'e', header: '', cell: (u) => (
      <Button size="sm" onClick={() => { setEditingCode(u.code); setCode(u.code); setLabel(u.label); setKind(u.measurement_kind); setError(null); setNote(null) }}>Edit</Button>
    ) },
  ]
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Units" description="Units the business measures in. Code is the short form printed next to quantities (kg, t, m3); Label is the full name. A unit is always optional on a line or stock item." />
        <DataTable dense columns={columns} rows={units.data} rowKey={(u) => u.code} loading={units.isLoading} error={units.error} empty={{ title: 'No units defined yet' }} />
        <form
          className="grid gap-3 border-t border-stone-100 p-5 sm:grid-cols-4 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            if (!code.trim() || !label.trim()) return setError('Code and label are required.')
            setError(null)
            setNote(null)
            if (editingCode) save.mutate({ code: editingCode, label: label.trim(), kind }, { onError: (er) => setError(er.message) })
            else add.mutate({ code: code.trim(), label: label.trim(), measurement_kind: kind }, { onError: (er) => setError(er.message) })
          }}
        >
          <FormField label="Code" hint={editingCode ? 'The code cannot be changed once created.' : 'Short, e.g. kg, t, m3'}>
            {(p) => <Input {...p} value={code} disabled={!!editingCode} onChange={(e) => setCode(e.target.value)} />}
          </FormField>
          <FormField label="Label" hint="Full name, e.g. Cubic metre">{(p) => <Input {...p} value={label} onChange={(e) => setLabel(e.target.value)} />}</FormField>
          <FormField label="Kind">{(p) => <Select {...p} value={kind} onChange={(e) => setKind(e.target.value as Unit['measurement_kind'])}>{Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</FormField>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={add.isPending || save.isPending}>{editingCode ? 'Save changes' : 'Add unit'}</Button>
            {editingCode && <Button type="button" onClick={() => { setEditingCode(null); setCode(''); setLabel(''); setKind('other'); setError(null) }}>Cancel</Button>}
          </div>
        </form>
        {error && <p className="px-5 pb-4 text-sm text-red-700" role="alert">{error}</p>}
        {note && <p className="px-5 pb-4 text-sm text-emerald-700" role="status">{note}</p>}
      </Card>

      <Card>
        <CardHeader title="Common quarry units" description="Tick the ones this business uses and add them in one go. Units are only a label: nothing is converted between them." />
        {available.length === 0 ? (
          <p className="p-5 text-sm text-stone-600">Every common unit is already in your list.</p>
        ) : (
          <div className="p-5">
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((u) => (
                <li key={u.code}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 ring-1 ring-stone-200 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={picked.has(u.code)}
                      onChange={(e) => setPicked((prev) => { const n = new Set(prev); if (e.target.checked) n.add(u.code); else n.delete(u.code); return n })}
                    />
                    <span className="text-sm">
                      <span className="font-medium text-stone-900">{u.label}</span>
                      <span className="block text-xs text-stone-500">{u.code} · {KIND_LABEL[u.measurement_kind]}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" disabled={picked.size === 0} loading={addMany.isPending} onClick={() => { setError(null); setNote(null); addMany.mutate(available.filter((u) => picked.has(u.code)), { onError: (er) => setError(er.message) }) }}>
                Add {picked.size || ''} selected unit{picked.size === 1 ? '' : 's'}
              </Button>
              <Button onClick={() => setPicked(new Set(available.map((u) => u.code)))}>Select all</Button>
              {picked.size > 0 && <Button onClick={() => setPicked(new Set())}>Clear</Button>}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Stock rules" description="Enforced by the database." />
        <ul className="list-disc space-y-2 p-5 pl-9 text-sm text-stone-700">
          <li>Stock is movement-based; current stock = opening + received − used/sold ± adjustments.</li>
          <li>Stock can never go below zero, and quantities cannot be edited directly.</li>
          <li>Bills and measurement sheets do not move stock; only explicit movements do.</li>
        </ul>
      </Card>
    </div>
  )
}

function accessSummary(s: StaffProfile): string {
  if (s.role === 'admin') return 'Everything'
  const eff = effectivePermissions('staff', s.permissions)
  const parts = PERMISSION_MODULES.filter((m) => eff[m.id] !== m.staffDefault).map((m) => `${m.label}: ${LEVEL_LABEL[eff[m.id]].toLowerCase()}`)
  return parts.length ? parts.join(' · ') : 'Standard staff access'
}

function UsersTab() {
  const { userId } = useBusinessContext()
  const query = useBizQuery(['staff', 'list'], listStaff)
  const update = useBizMutation((c, v: { id: string; patch: Partial<Pick<StaffProfile, 'role' | 'status' | 'permissions'>> }) => updateStaff(c, v.id, v.patch), { invalidate: [['staff']] })
  const create = useBizMutation(createStaffProfile, { invalidate: [['staff']], onSuccess: () => { setId(''); setName('') } })
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [lEmail, setLEmail] = useState('')
  const [lPassword, setLPassword] = useState('')
  const [lName, setLName] = useState('')
  const [lRole, setLRole] = useState<'admin' | 'staff'>('staff')
  const [lAccess, setLAccess] = useState<PermissionValue>(() => effectivePermissions('staff', null))
  const [lDone, setLDone] = useState<string | null>(null)
  const [editing, setEditing] = useState<StaffProfile | null>(null)
  const [draft, setDraft] = useState<PermissionValue>(() => effectivePermissions('staff', null))
  const [error, setError] = useState<string | null>(null)
  const login = useBizMutation(createStaffLogin, {
    invalidate: [['staff']],
    onSuccess: () => { setLDone(`Login created for ${lEmail.trim()}. Share the email and password with them privately.`); setLEmail(''); setLPassword(''); setLName(''); setLAccess(effectivePermissions('staff', null)) },
  })

  function openAccess(s: StaffProfile) {
    setEditing(s)
    setDraft(effectivePermissions('staff', s.permissions))
    setError(null)
  }

  const columns: Column<StaffProfile>[] = [
    { key: 'n', header: 'Name', cell: (s) => <span className="font-medium text-stone-900">{s.full_name}{s.user_id === userId ? ' (you)' : ''}</span> },
    { key: 'r', header: 'Role', cell: (s) => (
      <Select aria-label={`Role for ${s.full_name}`} className="w-28" value={s.role} disabled={s.user_id === userId} onChange={(e) => update.mutate({ id: s.user_id, patch: { role: e.target.value as 'admin' | 'staff' } }, { onError: (er) => setError(er.message) })}>
        <option value="admin">Admin</option><option value="staff">Staff</option>
      </Select>) },
    { key: 'a', header: 'Access', cell: (s) => (
      <div className="flex items-center gap-3">
        <span className="max-w-xs text-xs text-stone-600">{accessSummary(s)}</span>
        {s.role === 'staff' && <Button size="sm" onClick={() => openAccess(s)}>Edit access</Button>}
      </div>) },
    { key: 's', header: 'Status', cell: (s) => (
      <Button size="sm" disabled={s.user_id === userId} onClick={() => update.mutate({ id: s.user_id, patch: { status: s.status === 'active' ? 'inactive' : 'active' } }, { onError: (er) => setError(er.message) })}>
        <StatusBadge tone={s.status === 'active' ? 'success' : 'neutral'}>{s.status}</StatusBadge> {s.status === 'active' ? 'Deactivate' : 'Activate'}
      </Button>) },
  ]
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Staff" description="Deactivating a user blocks their access to this business immediately. “Edit access” sets what one person can see and change." />
        <DataTable dense columns={columns} rows={query.data} rowKey={(s) => s.user_id} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} empty={{ title: 'No staff profiles' }} />
        {error && <p className="px-5 pb-4 text-sm text-red-700" role="alert">{error}</p>}
      </Card>

      <Card>
        <CardHeader title="Add a staff login" description="Creates the sign-in and gives it access to THIS business only. You choose the password and pass it to them; they can change it later with “Forgot password”." />
        <form
          className="grid gap-3 p-5 sm:grid-cols-2 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            setLDone(null)
            if (!lName.trim()) return setError("Enter the person's name.")
            if (lPassword.length < 8) return setError('The password must be at least 8 characters.')
            setError(null)
            login.mutate(
              { email: lEmail.trim(), password: lPassword, full_name: lName.trim(), role: lRole, permissions: lRole === 'staff' ? compactPermissions(lAccess) : null },
              { onError: (er) => setError(er.message) },
            )
          }}
        >
          <FormField label="Full name" required>{(p) => <Input {...p} required value={lName} onChange={(e) => setLName(e.target.value)} />}</FormField>
          <FormField label="Email" required>{(p) => <Input {...p} type="email" required autoComplete="off" value={lEmail} onChange={(e) => setLEmail(e.target.value)} />}</FormField>
          <FormField label="Password" required hint="At least 8 characters.">{(p) => <PasswordInput {...p} required autoComplete="new-password" value={lPassword} onChange={(e) => setLPassword(e.target.value)} />}</FormField>
          <FormField label="Role">{(p) => <Select {...p} value={lRole} onChange={(e) => { const r = e.target.value as 'admin' | 'staff'; setLRole(r); setLAccess(effectivePermissions('staff', null)) }}><option value="staff">Staff</option><option value="admin">Admin</option></Select>}</FormField>
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-stone-800">{lRole === 'admin' ? 'What an admin can do' : 'What this person can do — change anything that does not fit their job'}</p>
            <PermissionGrid role={lRole} value={lAccess} onChange={setLAccess} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" loading={login.isPending}>Create login</Button>
            {lDone && <p className="mt-3 text-sm text-emerald-700" role="status">{lDone}</p>}
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Grant access to an existing login" description="For a login you already created in Supabase → Authentication → Users for THIS business's project: paste their User ID here." />
        <div className="grid gap-3 p-5 sm:grid-cols-4 sm:items-end">
          <FormField label="User ID (UUID)" className="sm:col-span-2">{(p) => <Input {...p} value={id} onChange={(e) => setId(e.target.value)} />}</FormField>
          <FormField label="Full name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</FormField>
          <FormField label="Role">{(p) => <Select {...p} value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}><option value="staff">Staff</option><option value="admin">Admin</option></Select>}</FormField>
          <Button variant="primary" className="sm:col-span-4 sm:w-fit" loading={create.isPending} onClick={() => {
            if (!/^[0-9a-f-]{36}$/i.test(id.trim())) return setError('Enter the user\'s UUID.')
            if (!name.trim()) return setError('Enter the person\'s name.')
            setError(null)
            create.mutate({ user_id: id.trim(), full_name: name.trim(), role, phone: null, permissions: null }, { onError: (e) => setError(e.message) })
          }}>Grant access</Button>
        </div>
      </Card>

      <Modal
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        title={editing ? `Access for ${editing.full_name}` : 'Access'}
        description="Choose what this person can see and change. Anything left at the standard setting follows the role default."
        size="lg"
        footer={
          <>
            <Button onClick={() => setDraft(effectivePermissions('staff', null))}>Reset to standard</Button>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={update.isPending}
              onClick={() => {
                if (!editing) return
                update.mutate({ id: editing.user_id, patch: { permissions: compactPermissions(draft) } }, {
                  onSuccess: () => setEditing(null),
                  onError: (er) => setError(er.message),
                })
              }}
            >
              Save access
            </Button>
          </>
        }
      >
        <PermissionGrid role="staff" value={draft} onChange={setDraft} />
      </Modal>
    </div>
  )
}

function PermissionsTab() {
  const groups = ['Sales', 'Inventory', 'Transport', 'Finance'] as const
  const cell = (lvl: PermissionLevel) => (
    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', lvl === 'edit' ? 'bg-emerald-50 text-emerald-800' : lvl === 'view' ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600')}>
      {LEVEL_LABEL[lvl]}
    </span>
  )
  return (
    <Card>
      <CardHeader title="Role permissions" description="What each role gets by default. Enforced by the database (row-level security), not just the menu. To change ONE person, use “Edit access” under Users / staff." />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="px-5 py-2 font-medium">Area</th>
              <th className="px-3 py-2 font-medium">Admin</th>
              <th className="px-3 py-2 font-medium">Staff (default)</th>
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((g) =>
              PERMISSION_MODULES.filter((m) => m.group === g).map((m) => (
                <tr key={m.id} className="border-b border-stone-100">
                  <td className="px-5 py-2.5 text-stone-800">{m.label} <span className="text-xs text-stone-400">· {g}</span></td>
                  <td className="px-3 py-2.5">{cell(m.levels.includes('edit') ? 'edit' : 'view')}</td>
                  <td className="px-3 py-2.5">{cell(m.staffDefault)}</td>
                </tr>
              )),
            )}
            <tr className="border-b border-stone-100">
              <td className="px-5 py-2.5 text-stone-800">Settings, staff management, audit logs</td>
              <td className="px-3 py-2.5">{cell('edit')}</td>
              <td className="px-3 py-2.5">{cell('none')}</td>
            </tr>
            <tr>
              <td className="px-5 py-2.5 text-stone-800">Cancel a bill · delete a draft bill · ledger adjustments</td>
              <td className="px-3 py-2.5">{cell('edit')}</td>
              <td className="px-3 py-2.5">{cell('none')}</td>
            </tr>
          </tbody>
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
        ].map(([k, v]) => <div key={k} className="flex justify-between gap-6"><dt className="text-stone-500">{k}</dt><dd className="break-all text-right font-medium text-stone-900">{v}</dd></div>)}
      </dl>
    </Card>
  )
}

function DemoTab() {
  const { client } = useBusinessContext()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  async function handleSeed() {
    if (!client) return setStatus({ type: 'error', message: 'Database client not connected.' })
    setLoading(true)
    setStatus(null)
    try {
      const res = await seedDemoData(client)
      setStatus({ type: 'success', message: res.message })
    } catch (e) {
      setStatus({ type: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  async function handleClear() {
    if (!client) return setStatus({ type: 'error', message: 'Database client not connected.' })
    if (!window.confirm('Are you sure you want to remove all DEMO records?')) return
    setLoading(true)
    setStatus(null)
    try {
      const res = await clearDemoData(client)
      setStatus({ type: 'success', message: res.message })
    } catch (e) {
      setStatus({ type: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Stone Quarry Demo & Test Data"
        description="Populate connected demo records to test all workflow components (Customers, Units, Materials, Stock, Vehicles, Drivers, Bills, Quotations, Measurements, Trips, Expenses). You can delete them anytime."
      />
      <div className="space-y-4 p-5">
        {status && (
          <div
            className={cn(
              'rounded-lg p-4 text-sm font-medium',
              status.type === 'success' ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-red-50 text-red-800 ring-1 ring-red-200',
            )}
          >
            {status.message}
          </div>
        )}

        <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 text-sm text-stone-800">
          <h3 className="font-bold text-amber-900">What will be created:</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-stone-700">
            <li><strong>Units</strong>: SQT (Sq. Feet), Tonne, Brass, CFT, Kg, Pieces</li>
            <li><strong>Customers</strong>: Sri Murudeshwara Builders, Rajesh Kumar - Granite Crafts, Kaveri Infra</li>
            <li><strong>Materials</strong>: Cut Stone Slabs 6380, Rough Granite Blocks, 20mm Jelly, M-Sand</li>
            <li><strong>Transport</strong>: Tipper KA-47-M-1122, Dumper KA-20-B-3344 & Licensed Drivers</li>
            <li><strong>Documents</strong>: Sample Quotation, Sales Bill, Measurement Sheet, Trip & Fuel Expense</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            variant="accent"
            loading={loading}
            onClick={handleSeed}
            className="bg-gradient-to-r from-[#d4af37] via-[#c59b27] to-[#b8860b] font-bold text-white hover:brightness-105"
          >
            Load Stone Quarry Demo Data
          </Button>
          <Button
            variant="secondary"
            disabled={loading}
            onClick={handleClear}
            className="border-stone-300 text-stone-600 hover:bg-red-50 hover:text-red-700"
          >
            Clear Demo Data
          </Button>
        </div>
      </div>
    </Card>
  )
}

