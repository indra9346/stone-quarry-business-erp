import { Link } from 'react-router-dom'
import { useBusinessContext } from './businessContextValue'
import AuthShell from './AuthShell'

/**
 * Shown for a registered business whose operational database has not been
 * connected in this installation (its VITE_<CODE>_SUPABASE_* variables are
 * absent). Nothing is fetched: no Supabase client exists for this business and
 * no other business's credentials are ever used as a fallback.
 */
export default function NotProvisioned() {
  const { profile } = useBusinessContext()
  return (
    <AuthShell title="Operational workspace not yet available">
      <p className="text-sm text-stone-600">
        The {profile.name} database has not been provisioned for this ERP installation.
      </p>
      <p className="mt-2 text-sm text-stone-600">Contact the system administrator after the business database is connected.</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md bg-navy-800 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-700"
      >
        Back to Business Gateway
      </Link>
    </AuthShell>
  )
}
