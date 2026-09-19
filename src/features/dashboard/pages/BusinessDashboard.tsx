import { useBusinessContext } from '@/features/auth/BusinessContext'

/**
 * Business Dashboard shell (spec section 19/24). Deliberately shows an
 * honest empty state rather than fabricated KPI numbers (Rule #58/#95) —
 * real queries against this business's isolated database land here in
 * Phase 6 (see BUSINESS_RULES.md roadmap) once schema + seed data exist.
 */
export default function BusinessDashboard() {
  const { profile } = useBusinessContext()

  const kpis = [
    "Today's Sales",
    'Outstanding',
    'Stock',
    'Trips',
    'Expenses',
    'Quotations',
  ]

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-100">{profile.name} — Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Business Dashboard. Data connects once this business's database migrations are applied.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((label) => (
          <div
            key={label}
            className="rounded-lg border border-white/10 bg-graphite-900/60 p-4"
          >
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-semibold text-slate-600">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
