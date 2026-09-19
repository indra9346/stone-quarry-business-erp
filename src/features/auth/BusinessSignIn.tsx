import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useBusinessContext } from './businessContextValue'
import AuthShell from './AuthShell'
import NoAccess from './NoAccess'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/form'
import { Spinner } from '@/components/ui/feedback'

/** Business authentication — the entry to ONE business portal. */
export default function BusinessSignIn() {
  const { code, profile, accessState, signIn } = useBusinessContext()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (accessState === 'loading') {
    return (
      <AuthShell title="Checking your session…">
        <div className="flex justify-center py-6">
          <Spinner className="h-6 w-6" />
        </div>
      </AuthShell>
    )
  }
  if (accessState === 'ready') return <Navigate to={`/business/${code}/dashboard`} replace />
  if (accessState === 'no_access') return <NoAccess />

  if (accessState === 'unconfigured') {
    return (
      <AuthShell title="Configuration pending" subtitle={`${profile.name} has no database connected yet.`}>
        <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <p>
            No operational data is shown for this business until its Supabase project is configured. Add{' '}
            <code className="rounded bg-white px-1 py-0.5 text-xs">VITE_{code.toUpperCase()}_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-white px-1 py-0.5 text-xs">VITE_{code.toUpperCase()}_SUPABASE_ANON_KEY</code> to{' '}
            <code className="rounded bg-white px-1 py-0.5 text-xs">.env.local</code> and restart.
          </p>
        </div>
      </AuthShell>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signIn(email.trim(), password)
    setSubmitting(false)
    if (error) {
      setError(error === 'Invalid login credentials' ? 'Incorrect email or password.' : error)
      return
    }
    navigate(`/business/${code}/dashboard`)
  }

  return (
    <AuthShell title="Sign in" subtitle="Use the account issued for this business.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Email" required>
          {(p) => <Input {...p} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </FormField>
        <FormField label="Password" required>
          {(p) => (
            <Input {...p} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </FormField>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="accent" className="w-full" loading={submitting}>
          Sign in to {profile.name.split(' ')[0]}
        </Button>
        <div className="text-center">
          <Link to={`/business/${code}/forgot-password`} className="text-sm text-cyan-700 hover:underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
