import {
  BarChart3,
  BookOpen,
  Boxes,
  FileText,
  IdCard,
  LayoutDashboard,
  Landmark,
  Receipt,
  Route as RouteIcon,
  Ruler,
  ScrollText,
  Settings,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleId, PermissionLevel } from '@/lib/permissions'

export interface NavItem {
  label: string
  /** Path relative to /business/:code */
  to: string
  icon: LucideIcon
  /** Shown only to admins (settings, audit logs). */
  adminOnly?: boolean
  /** Shown when the person has at least view access to this module. */
  module?: ModuleId
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * The menu is a convenience, NOT the security boundary: routes are guarded
 * again in App.tsx (RequireModule / RequireAdmin) and the database's RLS is the
 * final authority. Modules follow each person's access (src/lib/permissions.ts);
 * Settings and Audit Logs are always admin-only.
 */
export const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', to: 'dashboard', icon: LayoutDashboard }] },
  {
    label: 'Sales',
    items: [
      { label: 'Bills', to: 'bills', icon: Receipt, module: 'bills' },
      { label: 'Quotations', to: 'quotations', icon: FileText, module: 'quotations' },
      { label: 'Measurements', to: 'measurements', icon: Ruler, module: 'measurements' },
      { label: 'Customers', to: 'customers', icon: Users, module: 'customers' },
      { label: 'Payments', to: 'payments', icon: Wallet, module: 'payments' },
      { label: 'Customer Ledger', to: 'ledger', icon: BookOpen, module: 'ledger' },
    ],
  },
  { label: 'Inventory', items: [{ label: 'Stock / Raw Material', to: 'stock', icon: Boxes, module: 'stock' }] },
  {
    label: 'Transport',
    items: [
      { label: 'Vehicles', to: 'vehicles', icon: Truck, module: 'vehicles' },
      { label: 'Drivers', to: 'drivers', icon: IdCard, module: 'drivers' },
      { label: 'Trips', to: 'trips', icon: RouteIcon, module: 'trips' },
    ],
  },
  {
    label: 'Finance & Admin',
    items: [
      { label: 'Expenses', to: 'expenses', icon: Landmark, module: 'expenses' },
      { label: 'Reports', to: 'reports', icon: BarChart3, module: 'reports' },
      { label: 'Settings', to: 'settings', icon: Settings, adminOnly: true },
      { label: 'Audit Logs', to: 'audit-logs', icon: ScrollText, adminOnly: true },
    ],
  },
]

export function navFor(isAdmin: boolean, can: (module: ModuleId, need?: PermissionLevel) => boolean): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => (i.adminOnly ? isAdmin : i.module ? can(i.module, 'view') : true)),
  })).filter((g) => g.items.length > 0)
}
