import { Navigate, Outlet } from 'react-router-dom'
import { useBusinessContext } from './businessContextValue'
import NoAccess from './NoAccess'
import { AccessDenied, Spinner } from '@/components/ui/feedback'
import { Button } from '@/components/ui/Button'
import { Link } from 'react-router-dom'

/**
 * Client-side route guard (UX). Unauthenticated or unauthorised users never
 * reach business modules by URL — but the real enforcement is RLS in the
 * business's own database.
 */
export default function ProtectedBusinessRoute() {
  const { accessState, code } = useBusinessContext()

  if (accessState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100" role="status" aria-label="Loading session">
        <Spinner className="h-7 w-7" />
      </div>
    )
  }
  if (accessState === 'unconfigured' || accessState === 'signed_out') return <Navigate to={`/business/${code}`} replace />
  if (accessState === 'no_access') return <NoAccess />
  return <Outlet />
}

/** Admin-only routes: a Staff user who types the URL sees Access Denied and no data is requested. */
export function RequireAdmin() {
  const { isAdmin, code } = useBusinessContext()
  if (!isAdmin) {
    return (
      <AccessDenied
        action={
          <Link to={`/business/${code}/dashboard`}>
            <Button variant="primary">Return to dashboard</Button>
          </Link>
        }
      />
    )
  }
  return <Outlet />
}
