import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useBusinessContext } from './businessContextValue'
import AuthShell from './AuthShell'
import NoAccess from './NoAccess'
import NotProvisioned from './NotProvisioned'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/form'
import { PasswordInput } from '@/components/ui/PasswordInput'
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

  if (accessState === 'unconfigured') return <NotProvisioned />

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
            <PasswordInput {...p} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
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
          <Link to={`/business/${code}/forgot-password`} className="text-sm text-amber-800 hover:underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
