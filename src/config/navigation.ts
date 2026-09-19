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

export interface NavItem {
  label: string
  /** Path relative to /business/:code */
  to: string
  icon: LucideIcon
  adminOnly?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * The menu is a convenience, NOT the security boundary: routes are guarded
 * again in App.tsx (RequireAdmin) and the database's RLS is the final authority.
 * Admin-only here mirrors the database: Customer Ledger, Expenses and Audit
 * Logs (plus Settings and Reports) are admin-only.
 */
export const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', to: 'dashboard', icon: LayoutDashboard }] },
  {
    label: 'Sales',
    items: [
      { label: 'Bills', to: 'bills', icon: Receipt },
      { label: 'Quotations', to: 'quotations', icon: FileText },
      { label: 'Measurements', to: 'measurements', icon: Ruler },
      { label: 'Customers', to: 'customers', icon: Users },
      { label: 'Payments', to: 'payments', icon: Wallet },
      { label: 'Customer Ledger', to: 'ledger', icon: BookOpen, adminOnly: true },
    ],
  },
  { label: 'Inventory', items: [{ label: 'Stock / Raw Material', to: 'stock', icon: Boxes }] },
  {
    label: 'Transport',
    items: [
      { label: 'Vehicles', to: 'vehicles', icon: Truck },
      { label: 'Drivers', to: 'drivers', icon: IdCard },
      { label: 'Trips', to: 'trips', icon: RouteIcon },
    ],
  },
  {
    label: 'Finance & Admin',
    items: [
      { label: 'Expenses', to: 'expenses', icon: Landmark, adminOnly: true },
      { label: 'Reports', to: 'reports', icon: BarChart3, adminOnly: true },
      { label: 'Settings', to: 'settings', icon: Settings, adminOnly: true },
      { label: 'Audit Logs', to: 'audit-logs', icon: ScrollText, adminOnly: true },
    ],
  },
]

export function navFor(isAdmin: boolean): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.adminOnly) })).filter(
    (g) => g.items.length > 0,
  )
}
