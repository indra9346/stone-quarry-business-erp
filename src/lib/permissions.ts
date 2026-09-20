/**
 * Per-person access (mirrors supabase/migrations/business-template/013_permissions.sql).
 *
 * Each module has one of three levels for a person:
 *   none  no access      view  read only      edit  read and write
 * Admins always have everything. A module with no explicit value uses the role
 * default below (exactly what staff had before per-person access existed).
 * Settings, audit logs and staff management are admin-only and not listed here.
 *
 * This file only drives the menu, route guards and buttons; the database's
 * row-level security is what actually enforces it.
 */
export type PermissionLevel = 'none' | 'view' | 'edit'
export type ModuleId =
  | 'bills'
  | 'quotations'
  | 'measurements'
  | 'customers'
  | 'payments'
  | 'stock'
  | 'vehicles'
  | 'drivers'
  | 'trips'
  | 'ledger'
  | 'expenses'
  | 'reports'
export type Permissions = Partial<Record<ModuleId, PermissionLevel>>

export interface ModuleInfo {
  id: ModuleId
  label: string
  group: 'Sales' | 'Inventory' | 'Transport' | 'Finance'
  /** What "edit" means here. */
  editMeans: string
  levels: PermissionLevel[]
  /** Level a Staff member gets when nothing is set for them. */
  staffDefault: PermissionLevel
}

export const PERMISSION_MODULES: ModuleInfo[] = [
  { id: 'bills', label: 'Bills (EV & Normal)', group: 'Sales', editMeans: 'create and edit draft bills, post to ledger', levels: ['none', 'view', 'edit'], staffDefault: 'edit' },
  { id: 'quotations', label: 'Quotations', group: 'Sales', editMeans: 'create and edit quotations', levels: ['none', 'view', 'edit'], staffDefault: 'edit' },
  { id: 'measurements', label: 'Measurement sheets', group: 'Sales', editMeans: 'create and edit sheets', levels: ['none', 'view', 'edit'], staffDefault: 'edit' },
  { id: 'customers', label: 'Customers', group: 'Sales', editMeans: 'add and edit customers', levels: ['none', 'view', 'edit'], staffDefault: 'edit' },
  { id: 'payments', label: 'Payments', group: 'Sales', editMeans: 'record customer payments', levels: ['none', 'view', 'edit'], staffDefault: 'edit' },
  { id: 'ledger', label: 'Customer ledger', group: 'Finance', editMeans: 'read only (entries are system-generated)', levels: ['none', 'view'], staffDefault: 'none' },
  { id: 'stock', label: 'Stock / raw material', group: 'Inventory', editMeans: 'add stock items and record movements', levels: ['none', 'view', 'edit'], staffDefault: 'edit' },
  { id: 'vehicles', label: 'Vehicles', group: 'Transport', editMeans: 'add and edit vehicles', levels: ['none', 'view', 'edit'], staffDefault: 'edit' },
  { id: 'drivers', label: 'Drivers', group: 'Transport', editMeans: 'add and edit drivers', levels: ['none', 'view', 'edit'], staffDefault: 'edit' },
  { id: 'trips', label: 'Trips', group: 'Transport', editMeans: 'add and edit trips', levels: ['none', 'view', 'edit'], staffDefault: 'edit' },
  { id: 'expenses', label: 'Expenses', group: 'Finance', editMeans: 'record and edit expenses', levels: ['none', 'view', 'edit'], staffDefault: 'none' },
  { id: 'reports', label: 'Reports', group: 'Finance', editMeans: 'read only', levels: ['none', 'view'], staffDefault: 'none' },
]

const RANK: Record<PermissionLevel, number> = { none: 0, view: 1, edit: 2 }

export function allows(level: PermissionLevel, need: PermissionLevel): boolean {
  return RANK[level] >= RANK[need]
}

export function moduleInfo(id: ModuleId): ModuleInfo {
  const m = PERMISSION_MODULES.find((x) => x.id === id)
  if (!m) throw new Error(`Unknown module ${id}`)
  return m
}

/** The level a person effectively has for a module. */
export function levelFor(role: 'admin' | 'staff' | null, permissions: Permissions | null | undefined, id: ModuleId): PermissionLevel {
  if (role === 'admin') return 'edit'
  if (role !== 'staff') return 'none'
  const set = permissions?.[id]
  return set ?? moduleInfo(id).staffDefault
}

/** Full grid for a person: explicit values where set, role defaults elsewhere. */
export function effectivePermissions(role: 'admin' | 'staff', permissions: Permissions | null | undefined): Record<ModuleId, PermissionLevel> {
  return Object.fromEntries(PERMISSION_MODULES.map((m) => [m.id, levelFor(role, permissions, m.id)])) as Record<ModuleId, PermissionLevel>
}

/**
 * What to store: only the modules that differ from the staff default, or null
 * when nothing differs (so a later change to the defaults still applies).
 */
export function compactPermissions(full: Record<ModuleId, PermissionLevel>): Permissions | null {
  const out: Permissions = {}
  for (const m of PERMISSION_MODULES) {
    if (full[m.id] !== m.staffDefault) out[m.id] = full[m.id]
  }
  return Object.keys(out).length ? out : null
}

export const LEVEL_LABEL: Record<PermissionLevel, string> = { none: 'No access', view: 'View only', edit: 'View & edit' }
