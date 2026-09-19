import { Navigate, Outlet } from 'react-router-dom'
import { useBusinessContext } from './BusinessContext'

/**
 * Enforces Rule #26/#27: an unauthenticated or unauthorized user must never
 * reach business modules by navigating/guessing a URL. Real enforcement
 * still lives in each business's RLS policies (client-side routing is UX,
 * not the security boundary) — see supabase/migrations/business-template.
 */
export default function ProtectedBusinessRoute() {
  const { session, loading, profile } = useBusinessContext()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-navy-950" />
  }
  if (!session) {
    return <Navigate to={`/business/${profile.code}`} replace />
  }
  return <Outlet />
}
