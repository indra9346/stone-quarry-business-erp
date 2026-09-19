import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useBusinessContext } from './businessContextValue'
import AuthShell from './AuthShell'
import { Button } from '@/components/ui/Button'

/**
 * Signed in, but the database returned no ACTIVE staff profile for this user
 * in THIS business — an inactive account, or a person never granted access.
 * No business data is requested or shown.
 */
export default function NoAccess() {
  const { profile, email, code, signOut } = useBusinessContext()
  const navigate = useNavigate()
  return (
    <AuthShell title="Access denied" subtitle={`${email ?? 'This account'} cannot use ${profile.name}.`}>
      <div className="flex gap-3 rounded-md bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Your account is either inactive, or has not been granted access to this business. Ask an administrator of{' '}
          {profile.name} to activate it.
        </p>
      </div>
      <div className="mt-5 flex gap-2">
        <Button
          className="flex-1"
          onClick={async () => {
            await signOut()
            navigate(`/business/${code}`)
          }}
        >
          Sign out
        </Button>
        <Button className="flex-1" variant="primary" onClick={() => navigate('/')}>
          Choose another business
        </Button>
      </div>
    </AuthShell>
  )
}
