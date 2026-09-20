import { LEVEL_LABEL, PERMISSION_MODULES, type ModuleId, type PermissionLevel } from '@/lib/permissions'
import { cn } from '@/lib/utils'

export type PermissionValue = Record<ModuleId, PermissionLevel>

/**
 * One row per module with a None / View / Edit choice. Only the levels that
 * make sense for a module are offered (the ledger and reports are read-only).
 */
export function PermissionGrid({
  role,
  value,
  onChange,
  disabled,
}: {
  role: 'admin' | 'staff'
  value: PermissionValue
  onChange: (next: PermissionValue) => void
  disabled?: boolean
}) {
  if (role === 'admin') {
    return (
      <p className="rounded-md bg-stone-50 px-4 py-3 text-sm text-stone-700 ring-1 ring-stone-200">
        Administrators can use every module, and are the only people who can open Settings, staff management and the audit log.
      </p>
    )
  }
  const groups = ['Sales', 'Inventory', 'Transport', 'Finance'] as const
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-stone-500">{g}</p>
          <ul className="divide-y divide-stone-100 rounded-md ring-1 ring-stone-200">
            {PERMISSION_MODULES.filter((m) => m.group === g).map((m) => (
              <li key={m.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900">{m.label}</p>
                  <p className="text-xs text-stone-500">Edit = {m.editMeans}</p>
                </div>
                <div role="radiogroup" aria-label={`Access to ${m.label}`} className="flex shrink-0 overflow-hidden rounded-md ring-1 ring-stone-300">
                  {m.levels.map((lvl) => {
                    const on = value[m.id] === lvl
                    return (
                      <button
                        key={lvl}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={disabled}
                        onClick={() => onChange({ ...value, [m.id]: lvl })}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60',
                          on
                            ? lvl === 'none'
                              ? 'bg-stone-700 text-white'
                              : lvl === 'view'
                                ? 'bg-amber-500 text-navy-950'
                                : 'bg-emerald-600 text-white'
                            : 'bg-white text-stone-600 hover:bg-stone-50',
                        )}
                      >
                        {LEVEL_LABEL[lvl]}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
