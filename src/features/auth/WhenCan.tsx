import type { ReactNode } from 'react'
import { useBusinessContext } from './businessContextValue'
import type { ModuleId, PermissionLevel } from '@/lib/permissions'

/** Renders its children only when the person has at least `need` access to `module` (default: edit). */
export function WhenCan({ module, need = 'edit', children }: { module: ModuleId; need?: PermissionLevel; children: ReactNode }) {
  const { can } = useBusinessContext()
  return can(module, need) ? <>{children}</> : null
}

/** Renders its children for administrators only. */
export function WhenAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useBusinessContext()
  return isAdmin ? <>{children}</> : null
}
