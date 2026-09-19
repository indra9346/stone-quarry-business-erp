import { Navigate, useParams } from 'react-router-dom'
import { BUSINESS_CODES, type BusinessCode } from '@/types/business'
import { BusinessProvider } from '@/features/auth/BusinessContext'
import { Outlet } from 'react-router-dom'

/**
 * Reads :businessCode from the URL and, ONLY if it is one of the known
 * registry codes, mounts a BusinessProvider scoped to it. An unknown code
 * (someone hand-editing the URL) never reaches a provider at all — it is
 * redirected to the gateway rather than silently defaulting to a business
 * (Rule #15 — business context must never be inferred/guessed).
 */
export default function BusinessRouteWrapper() {
  const { businessCode } = useParams<{ businessCode: string }>()

  if (!businessCode || !BUSINESS_CODES.includes(businessCode as BusinessCode)) {
    return <Navigate to="/" replace />
  }

  return (
    <BusinessProvider code={businessCode as BusinessCode}>
      <Outlet />
    </BusinessProvider>
  )
}
